const app = angular.module('app', ['ionic', 'ngCordova', 'ngAnimate', 'ngMaterial'])

.run(($ionicPlatform) => {
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
      controller: 'TrainInfoCtrl' })
    .state('station-info', {
      url: '/station-info',
      templateUrl: './templates/station-info.html',
      controller: 'StationInfoCtrl' })
  $urlRouterProvider.otherwise('/choose');
})

.filter('abs', () => (num) => Math.abs(num))

.filter('fromNow', () => (dateStr) => {
  const date = moment(dateStr)
  return date.locale("fi").fromNow()
})

.filter('HHMM', () => (moment) => {
  return moment.locale('fi').format('LT')
})

.filter("remove", () => (input, remove) => !input || input.replace(remove, ''))
