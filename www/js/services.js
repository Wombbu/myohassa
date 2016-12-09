app
.service('uiUtil', function($cordovaToast, $ionicLoading, $state) {
  this.toast = (msg) => $cordovaToast.show(msg, 'short', 'center')

  this.load = () => $ionicLoading.show({
    template: 'Ladataan',
    duration: 5000,
    animation: 'fade-in',
    showBackdrop: true,
    maxWidth: 200})
  this.stopLoad = () => $ionicLoading.hide()

  this.date = (dateStr) => moment(dateStr)

  this.getDataSetState = (fetchFunc, newState) => {
    //this.load()
    fetchFunc(
      () => {
        $state.go(newState)
      },
      (error) => {
        this.toast(error)
      })
    }
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

  const get = (url) => (success, fail) => $http({ method: 'GET', url: url, timeout: 5000}).then(success, fail)
  const requestStations = stations || get('https://rata.digitraffic.fi/api/v1/metadata/stations')
  const requestCauses   = causes   || get('https://rata.digitraffic.fi/api/v1/metadata/cause-category-codes')

  this.fetchStations = () => {
    stations ||
    requestStations(res => stations = res.data)
  }

  this.fetchStops = (trainNumber) => (success, error) => {
    stopInfo = undefined
    const requestStops = get(`https://rata.digitraffic.fi/api/v1/live-trains/${trainNumber}`)
    const callbackIfAllFetched = () => {
      if (causes && stations && stopInfo) success()
    }

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
    trainInfo = undefined
    const getTrainInfo = get(`https://rata.digitraffic.fi/api/v1/compositions/${trainNumber}?departure_date=${moment().format('YYYY-MM-DD')}`)
    getTrainInfo(
      (res) => {
        if (!res.data.code) {
          trainInfo = res.data
          success()
        } else error("Junalle ei löytynyt vaunutietoa tälle päivälle. Onkohan junanumero oikea?")
      },
      () => error(errorMsg)
    )
  }

  this.fetchStationInfo = (stationCode) => (success, error) => {
    stationInfo = undefined
    const requestStationInfo = get(`https://rata.digitraffic.fi/api/v1/live-trains?station=${stationCode}&minutes_before_departure=120&minutes_after_departure=0&minutes_before_arrival=0&minutes_after_arrival=0`)
    const callbackIfAllFetched = () => !(stations && stationInfo) || success()

    requestStations(
      (res) => {
        stations = res.data
        callbackIfAllFetched()
      },
      (err) => error(errorMsg))

    requestStationInfo(
        (res) => {
          if(res.data[0]) {
            stationInfo = {trains: res.data, code: stationCode}
            callbackIfAllFetched()
          } else {
            console.log("perse", res)
            error("Asemalle ei löytynyt aikataulutietoja seuraavan kahden tunnin ajalle")
          }
        },
        () => error(errorMsg)
    )
  }
})

.service('parse', function() {
  //Because the functions in 'this' are assigned / used constantly here and
  //controllers, 'this' should be assigned to const named 'p' to keep the code cleaner
  const p = this


  //Timetablerows
  p.onlyPassengerStops = row => row.trainStopping && row.commercialStop && row.commercialTrack
  p.onlyArrivals = row => row.type === 'ARRIVAL'
  p.onlyDeparture = row => row.type === 'DEPARTURE'
  p.onlyThisStation = stationCode => row =>
    _.upperCase(row.stationShortCode) === _.upperCase(stationCode)
  p.passed = passed => row => {
    const inPast = moment().diff(
      moment(row.actualTime || row.liveEstimateTime || row.scheduledTime))
    return (inPast > 0) ? passed : !passed
  }
  p.getCauseExplanations = causes => row => {
    const explanations = row.causes.map(causeCodeToExplanation(causes))
    return Object.assign({}, row, explanations)
  }
  p.causeCodeToExplanation = explanations => cause => {
    const explanation = explanations.filter((exp) => cause.categoryCode == exp.categoryCode)[0]
    return explanation ? explanation.categoryName : "Syykoodi: " + cause.categoryCode
  }
  p.getStationName = stations => row => {
    const name = this.stationCodeToName(stations)(row.stationShortCode)
    return Object.assign({}, row, name )
  }
  p.stationCodeToName = stations => code => {
    var station =
      stations
      .filter(station => _.upperCase(code) == _.upperCase(station.stationShortCode))
    return station[0] ? station[0].stationName : code
  }
  p.addMomentTime = row => {
    const time = moment(row.actualTime || row.liveEstimateTime || row.scheduledTime)
    return Object.assign({}, row, {time})
  }
  p.addScheduledTime = row =>
    Object.assign({}, row, {scheduledTime: moment(row.scheduledTime)})

  p.momentPassed = now => passed => row => now.diff(row.time) > 0 ? passed : !passed
  p.between = (now) => (a, b) => now.diff(a) > 0 && now.diff(b) < 0
  p.earliestFirst = (a, b) => {
    var diff = a.diff(b)
    if(diff > 0) return 1
    else return -1
  }

  p.trainCategories = {longDistance: 'Long-distance', cargo: 'Cargo', commuter: 'Commuter'}

  //Trains
  const notPassengerTrainCodes = ["VET", "VLI", "T", "TYO", "MUV", "SAA", "LIV", "PAI"]
  p.filterNotPassengerTrains = train => notPassengerTrainCodes.indexOf(train.trainType) < 0

  //Train info
  p.specialWagon = wagon => wagon.catering || wagon.luggage || wagon.playground ||
                          wagon.disabled || wagon.smoking || wagon.video || wagon.pet

  p.addMomenTimeForJourneySection = section => {
    const begin = moment(section.beginTimeTableRow.scheduledTime)
    const end = moment(section.endTimeTableRow.scheduledTime)
    return Object.assign({}, section, {begin}, {end})
  }

  //Autofill
  p.includes = text => text2 => text2.toLowerCase().includes(text.toLowerCase())
  p.bestMatchesFirst = searchText => (a, b) => {
    const sl = searchText.toLowerCase()
    const al = a.toLowerCase()
    const bl = b.toLowerCase()
    if(al.startsWith(sl) && !bl.startsWith(sl)) return -1
    else if(!al.startsWith(sl) && bl.startsWith(sl)) return 1
    else return 0
  }
})
