angular.module('app', ['ionic', 'ngCordova'])
.run(($ionicPlatform, $rootScope, $ionicViewSwitcher, $ionicHistory) => {
  $ionicPlatform.ready(() => {
    if(window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
      cordova.plugins.Keyboard.disableScroll(true);
    }
    if(window.StatusBar) { StatusBar.styleDefault() }

    if(window.Connection && navigator.connection.type == Connection.NONE) {
      $ionicPopup.confirm({
        title: "Ei verkkoyhteyttä",
        content: "Laitteessasi ei ole verkkoyhteyttä"})
        .then((result) => ionic.Platform.exitApp() );
      }
  });
})
.config(($stateProvider, $urlRouterProvider) => {
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

  this.get = (url) => (success, fail) => $http({ method: 'GET', url: url }).then(success, fail)
  this.getCauses = this.get('https://rata.digitraffic.fi/api/v1/metadata/cause-category-codes')
  this.getStations = this.get('https://rata.digitraffic.fi/api/v1/metadata/stations')
  this.getTrains = (number) => this.get(`https://rata.digitraffic.fi/api/v1/live-trains/${number}`)

  this.doUntilSuccess = (reqFunc, maxTimes, success) => {
    if(maxTimes <= 0) return;
    reqFunc(
      (res) => success(res),
      (err) => this.doUntilSuccess(rewFunc, maxTimes-1, success))
  }

  this.fetch = (trainNumber, success, error) => {
      this.stations
      || this.doUntilSuccess(this.getStations, 20, (res) => this.stations = res.data)

      this.causes
      || this.doUntilSuccess(this.getCauses, 20, (res) => this.causes = res.data)

      this.getTrains(trainNumber)(
        (res) => (res.data.length != 0) ? (this.trainInfo = res.data, success()) : error("Junatietoja ei löytynyt. Onkohan junanumero oikea?"),
        (err) => error("Verkkovirhe. Hö.")
      )
  }
})
.service('uiUtil', function($cordovaToast, $ionicLoading) {
  this.shortToast = (msg) => $cordovaToast.show(msg, 'short', 'center')

  this.load = () => $ionicLoading.show({ template: 'Ladataan tietoja', duration: 3000 })
  this.stopLoad = () => $ionicLoading.hide()
})
.controller('ChooseCtrl', function($scope, $state, data, uiUtil) {
  $scope.train = {number:undefined}

  const fetchDataAndSwitchScene = () => {
    uiUtil.load()
    data.fetch(
      $scope.train.number,
      () => {uiUtil.stopLoad(); $state.go("info")},
      (error) => {uiUtil.stopLoad(); uiUtil.shortToast(error)})}

  $scope.tryFetchTrainData = () =>
    ($scope.train.number) ? fetchDataAndSwitchScene() : uiUtil.shortToast('Antaisitko junanumeron?')
})
.controller('InfoCtrl', function($ionicPlatform, $scope, $http, data, $state) {
  $scope.goToChoose = () => $state.go("choose");
})
