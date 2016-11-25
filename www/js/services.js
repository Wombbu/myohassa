app
.service('uiUtil', function($cordovaToast, $ionicLoading, $state) {
  this.toast = (msg) => $cordovaToast.show(msg, 'short', 'center')

  this.load = () => $ionicLoading.show({ template: 'Ladataan junan tietoja', duration: 3000 })
  this.stopLoad = () => $ionicLoading.hide()

  this.date = (dateStr) => moment(dateStr)

  this.getDataSetState = (fetchFunc, newState) => {
    this.load()
    fetchFunc(
      () => {this.stopLoad(); $state.go(newState, {}, {reload: true})},
      (error) => {this.stopLoad(); this.toast(error)})}
})

.service('data', function($http) {
  var causes = undefined
  var stations = undefined
  var stopInfo = undefined
  var trainInfo = undefined
  var stationInfo = undefined

  this.getCauses = () => _.cloneDeep(causes)
  this.getStations = () => _.cloneDeep(stations)
  this.getStopInfo = () => _.cloneDeep(stopInfo)
  this.getTrainInfo = () => _.cloneDeep(trainInfo)
  this.getStationInfo = () => _.cloneDeep(stationInfo)

  const errorMsg = "Verkkovirhe. Hö."
  const get = (url) => (success, fail) => $http({ method: 'GET', url: url }).then(success, fail)
  const requestStations = stations || get('https://rata.digitraffic.fi/api/v1/metadata/stations')
  const requestCauses   = causes   || get('https://rata.digitraffic.fi/api/v1/metadata/cause-category-codes')

  this.fetchStops = (trainNumber) => (success, error) => {
    const requestStops = get(`https://rata.digitraffic.fi/api/v1/live-trains/${trainNumber}`)
    const callbackIfAllFetched = () => !(causes && stations && stopInfo) || success()

    requestStations(
      (res) => {
        stations = res.data
        callbackIfAllFetched()
      },
      (err) => error(errorMsg))

    requestCauses(
      (res) => {
        causes = res.data
        callbackIfAllFetched()
      },
      (err) => error(errorMsg))

    requestStops(
      (res) => {
        if (res.data[0]) {
          stopInfo = res.data[0]
          callbackIfAllFetched()
        } else error("Tietoja ei löytynyt. Onkohan junanumero oikea?")
      }, (err) => error(errorMsg))
  }

  this.fetchTrainInfo = (trainNumber) => (success, error) => {
    const getTrainInfo = get(`https://rata.digitraffic.fi/api/v1/compositions/${trainNumber}?departure_date=${moment().format('YYYY-MM-DD')}`)
    getTrainInfo(
      (res) => {
        if (!res.data.code) {
          trainInfo = res.data
          success()
        } else {
          error("Junalle ei löytynyt vaunutietoa. Onkohan junanumero oikea?")
        }
      },
      () => error(errorMsg)
    )
  }

  this.fetchStationInfo = (station) => (success, error) => {
    const requestStationInfo = get(`https://rata.digitraffic.fi/api/v1/live-trains?station=${station}&minutes_before_departure=120&minutes_after_departure=0&minutes_before_arrival=0&minutes_after_arrival=0`)
    const callbackIfAllFetched = () => !(stations && stationInfo) || success()

    requestStations(
      (res) => {
        stations = res.data
        callbackIfAllFetched()
      },
      (err) => error(errorMsg))

    requestStationInfo(
        (res) => (res.data[0]) ? (stationInfo = res.data, callbackIfAllFetched()) : error("Tietoja ei löytynyt. Onkohan asemakoodi oikea?"),
        () => error(errorMsg)
    )
  }
})

.service('parse', function() {
  const p = this

  p.onlyPassengerStops = (row) => row.trainStopping && row.commercialStop
  p.onlyArrivals = (row) => row.type === 'ARRIVAL'
  p.onlyDeparture = (row) => row.type === 'DEPARTURE'

  p.passed = (passed) => (row) => {
    const inPast = moment().diff(
      moment(row.liveEstimateTime || row.actualTime || row.scheduledTime))
    return (inPast > 0) ? passed : !passed
  }

  //To be used with row with moment time
  p.momentPassed = (now) => (passed) => row => now.diff(row.time) > 0 ? passed : !passed

  p.causeCodeToExplanation = explanations => cause => {
    const explanation = explanations.filter((exp) => cause.categoryCode == exp.categoryCode)[0]
    return explanation ? explanation.categoryName : "Syykoodi: " + cause.categoryCode
  }
  p.getCauseExplanations = causes => row => {
    const explanations = row.causes.map(causeCodeToExplanation(causes))
    return Object.assign({}, row, explanations)
  }

  p.stationCodeToName = stations => code => {
    var station = stations.filter((station) => code == station.stationShortCode)
    return station[0] ? station[0].stationName : code
  }
  p.getStationName = stations => row => {
    const name =
    row.name = this.stationCodeToName(stations)(row.stationShortCode)
    return row
  }
  p.specialWagon = w => w.catering || w.luggage || w.playground ||
                          w.disabled || w.smoking || w.video || w.pet

  p.mapTimeTableRows = func => train => {
    train.timeTableRows = train.timeTableRows.map(func)
    return train
  }
  p.filterTimeTableRows = func => train => {
    if(!train.timeTableRows) return train
    train.timeTableRows = train.timeTableRows.filter(func);
    return train
  }

  p.onlyThisStation = row => row.stationShortCode === 'HKI'

  p.addMomentTime = row => {
    const time = moment(row.actualTime || row.liveEstimateTime || row.scheduledTime)
    return Object.assign({}, row, {time})
  }
  p.addMomenTimeForJourneySection = section => {
    const begin = moment(section.beginTimeTableRow.scheduledTime)
    const end = moment(section.endTimeTableRow.scheduledTime)
    return Object.assign({}, section, {begin}, {end})
  }
  p.between = (now) => (a, b) => now.diff(a) > 0 && now.diff(b) < 0

  p.timeStrToMoment = row => moment(row.actualTime || row.liveEstimateTime || row.scheduledTime)
  p.earliestFirst = (train1, train2) => {
    if (train1.timeTableRows[0].time.diff(train2.timeTableRows[0].time) > 0) return 1
    else return -1
    return 0
  }
  p.earliestFirst2 = (a, b) => {
    var diff = a.diff(b)
    if(diff > 0) return 1
    else return -1
  }
})
