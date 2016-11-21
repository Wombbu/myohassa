angular.module('app', ['ionic', 'ngCordova'])

.run(($ionicPlatform, $rootScope, $ionicViewSwitcher, $ionicHistory) => {
  $ionicPlatform.ready(() => {
    if(window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
      cordova.plugins.Keyboard.disableScroll(true);
    }

    if(window.StatusBar) { StatusBar.styleDefault() }
  });
})

.config(($stateProvider, $urlRouterProvider, $ionicConfigProvider) => {
  $ionicConfigProvider.scrolling.jsScrolling(false);
  $stateProvider
    .state('choose', {
      url: '/choose',
      templateUrl: './templates/pick-train.html',
      controller: 'ChooseCtrl' })
    .state('info', {
      url: '/info',
      templateUrl: './templates/train-info.html',
      controller: 'InfoCtrl' });
  $urlRouterProvider.otherwise('/choose');
})

.service('data', function($http) {
  this.causes = undefined
  this.stations = undefined
  this.trainInfo = undefined

  this.fetch = (trainNumber, success, error) => {
    const get = (url) => (success, fail) => $http({ method: 'GET', url: url }).then(success, fail)
    const getStations = get('https://rata.digitraffic.fi/api/v1/metadata/stations')
    const getCauses =   get('https://rata.digitraffic.fi/api/v1/metadata/cause-category-codes')
    const getTrains =   get(`https://rata.digitraffic.fi/api/v1/live-trains/${trainNumber}`)

    const callbackIfAllFetched = () => !(this.causes && this.stations && this.trainInfo) || success()
    const errorMsg = "Verkkovirhe. Hö."

      this.stations
      || getStations(
        (res) => {
          this.stations = res.data.filter((val) => val.passengerTraffic)
          callbackIfAllFetched()
        },
        (err) => error(errorMsg))

      this.causes
      || getCauses(
        (res) => {
          this.causes = res.data
          callbackIfAllFetched()
        },
        (err) => error(errorMsg))

      getTrains(
        (res) => (res.data[0]) ? (this.trainInfo = res.data[0], callbackIfAllFetched()) : error("Junatietoja ei löytynyt. Onkohan junanumero oikea?"),
        (err) => error(errorMsg))
  }
})

.service('uiUtil', function($cordovaToast, $ionicLoading) {
  this.toast = (msg) => $cordovaToast.show(msg, 'short', 'center')

  this.load = () => $ionicLoading.show({ template: 'Ladataan junan tietoja', duration: 3000 })
  this.stopLoad = () => $ionicLoading.hide()
})

.filter('abs', () => (num) => Math.abs(num))

.filter('fromNow', () => (dateStr) => {
  const date = moment(dateStr)
  return date.locale("fi").fromNow()
})

.filter("remove", () => (input, remove) => !input || input.replace(remove, ''))

.controller('ChooseCtrl', function($scope, $state, data, uiUtil) {
  $scope.train = {number: undefined}

  const fetchDataAndSwitchScene = () => {
    uiUtil.load()
    data.fetch(
      $scope.train.number,
      () => {uiUtil.stopLoad(); $state.go("info")},
      (error) => {uiUtil.stopLoad(); uiUtil.toast(error)})}

  $scope.tryFetchTrainData = () =>
    ($scope.train.number) ? fetchDataAndSwitchScene() : uiUtil.toast('Antaisitko junanumeron?')
})

.controller('InfoCtrl', function($ionicPlatform, $scope, data) {
  const onlyPassengerStops = (stop) => stop.trainStopping && stop.commercialStop
  const onlyArrivals = (stop) => stop.type === 'ARRIVAL'

  const causeCodeToExplanation = (cause) => data.causes.filter((cause2) => cause.categoryCode == cause2.categoryCode)[0].categoryName
  const getCauseExplanationsForStop = (stop) => {
    stop.causes = stop.causes.map(causeCodeToExplanation)
    return stop
  }

  const stationCodeToName = (code) => {
    var station = data.stations.filter((station) => code == station.stationShortCode)
    return station[0] ? station[0].stationName : code
  }
  const getStationName = (stop) => {
    stop.name = stationCodeToName(stop.stationShortCode)
    return stop
  }

  const setScopeData = (train) => {
    $scope.trainType = train.trainType
    $scope.trainNumber = train.trainNumber

    const stops =
      train.timeTableRows
      .map(getCauseExplanationsForStop)
      .map(getStationName)
      .filter(onlyArrivals)
      .filter(onlyPassengerStops)

    const prevStops = stops.filter((stop) => !stop.liveEstimateTime)
    const nextStops = stops.filter((stop) => stop.liveEstimateTime)

    if(nextStops[0]) {
      $scope.timeDiff = nextStops[0].differenceInMinutes
      $scope.prevStops = prevStops;
      $scope.nextStops = nextStops;
    }
  }
  setScopeData(data.trainInfo)
})
