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
    .state('stop-info', {
      url: '/stop-info',
      templateUrl: './templates/stop-info.html',
      controller: 'StopInfoCtrl' })
    .state('train-info', {
      url: '/train-info',
      templateUrl: './templates/train-info.html',
      controller: 'TrainInfoCtrl' });
  $urlRouterProvider.otherwise('/choose');
})

.filter('abs', () => (num) => Math.abs(num))

.filter('fromNow', () => (dateStr) => {
  const date = moment(dateStr)
  return date.locale("fi").fromNow()
})

.filter("remove", () => (input, remove) => !input || input.replace(remove, ''))

.service('data', function($http) {
  this.causes = undefined
  this.stations = undefined
  this.stopInfo = undefined
  this.trainInfo = undefined

  const get = (url) => (success, fail) => $http({ method: 'GET', url: url }).then(success, fail)

  this.getStops = (trainNumber) => (success, error) => {
    const getStations = get('https://rata.digitraffic.fi/api/v1/metadata/stations')
    const getCauses =   get('https://rata.digitraffic.fi/api/v1/metadata/cause-category-codes')
    const getStops =   get(`https://rata.digitraffic.fi/api/v1/live-trains/${trainNumber}`)
    const callbackIfAllFetched = () => !(this.causes && this.stations && this.stopInfo) || success()
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

      getStops(
        (res) => (res.data[0]) ? (this.stopInfo = res.data[0], callbackIfAllFetched()) : error("Tietoja ei löytynyt. Onkohan junanumero oikea?"),
        (err) => error(errorMsg))
  }

  this.getTrainInfo = (trainNumber) => (success, error) => {
    const getTrainInfo = get(`https://rata.digitraffic.fi/api/v1/compositions/${trainNumber}?departure_date=${moment().format('YYYY-MM-DD')}`)
    getTrainInfo(
      (res) => {
        this.trainInfo = res.data
        success()
      }, () => error("Tietoja ei löytynyt. Onkohan junanumero oikea?")
    )
  }
})

.service('uiUtil', function($cordovaToast, $ionicLoading) {
  this.toast = (msg) => $cordovaToast.show(msg, 'short', 'center')

  this.load = () => $ionicLoading.show({ template: 'Ladataan junan tietoja', duration: 3000 })
  this.stopLoad = () => $ionicLoading.hide()
  this.date = (dateStr) => moment(dateStr)
})

.controller('ChooseCtrl', function($scope, $state, data, uiUtil) {
  $scope.train = {number: 865}

  const getDataSetState = (fetchFunc, newState) => {
    uiUtil.load()
    fetchFunc(
      () => {uiUtil.stopLoad(); $state.go(newState)},
      (error) => {uiUtil.stopLoad(); uiUtil.toast(error)})}

  $scope.tryFetchStopData = (train) =>
    ($scope.train.number) ? getDataSetState(data.getStops(train), "stop-info") : uiUtil.toast('Antaisitko junanumeron?')

  $scope.tryFetchTrainData = (train) =>
    ($scope.train.number) ? getDataSetState(data.getTrainInfo(train), "train-info") : uiUtil.toast('Antaisitko junanumeron?')
})

.controller('StopInfoCtrl', function($scope, data) {
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

  const passed = (passed) => (stop) => {
    const inPast = moment().diff(
      moment(stop.liveEstimateTime || stop.actualTime || stop.scheduledTime))
    return (inPast > 0) ? passed : !passed
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

    const prevStops = stops.filter(passed(true))
    const nextStops = stops.filter(passed(false))

    if(nextStops[0]) {
      $scope.timeDiff = nextStops[0].differenceInMinutes
      $scope.prevStops = prevStops;
      $scope.nextStops = nextStops;
    }
  }
  setScopeData(data.stopInfo)
})

.controller('TrainInfoCtrl', function($scope, data) {
  const betweenTimes = (now, dateParser) => (before, after) =>
    now.diff(dateParser(before)) > 0 && now.diff(dateParser(after)) < 0
  const begin = (obj) => obj.beginTimeTableRow.scheduledTime
  const end = (obj) => obj.endTimeTableRow.scheduledTime

  const setScopeData = (train) => {
    $scope.trainType = train.trainType
    $scope.trainNumber = train.trainNumber

    const thisMomentBetween = betweenTimes(moment(), moment)
    const currentSetup = data.trainInfo.journeySections
      .filter((section) => thisMomentBetween(begin(section), end(section)))[0]

    if(currentSetup) {
      console.log(currentSetup)
      $scope.locomotives = currentSetup.locomotives.length
      $scope.topSpeed = currentSetup.maximumSpeed
      $scope.length = currentSetup.totalLength

      $scope.wagons = currentSetup.wagons
      console.log(currentSetup.wagons)
    }

  }
  setScopeData(data.trainInfo)
})
