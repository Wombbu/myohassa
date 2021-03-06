app
.controller('ChooseCtrl', function($scope, $state, data, uiUtil, parse) {
  $scope.train = {number: undefined}
  $scope.selectedStationCode = undefined
  data.fetchStations()

  $scope.filterStations = (searchText) => {
    const stations = data.getStations() || data.fetchStations()
    const bestMatchesFirst = parse.bestMatchesFirst(searchText)
    $scope.stations = stations
      ? stations
        .filter((station) => parse.includes(searchText)(station.stationName))
        .sort((station1, station2) => bestMatchesFirst(station1.stationName, station2.stationName))
      : []
  }

  $scope.selectStation = station => {
    if(station && station.stationShortCode) tryFetchStationData(station.stationShortCode)
    else uiUtil.toast("Valitse ensin asema listasta")
  }

  $scope.stationInput = ""

  $scope.tryFetchStopData = (train) =>
    ($scope.train.number)
      ? uiUtil.getDataSetState(data.fetchStops(train), "stop-info")
      : uiUtil.toast('Antaisitko junanumeron?')

  $scope.tryFetchTrainData = (train) =>
    ($scope.train.number)
      ? uiUtil.getDataSetState(data.fetchTrainInfo(train), "train-info")
      : uiUtil.toast('Antaisitko junanumeron?')

  const tryFetchStationData = (station) =>
    (station)
      ? uiUtil.getDataSetState(data.fetchStationInfo(station), "station-info")
      : uiUtil.toast('Valitsisitko aseman?')
})

.controller('StopInfoCtrl', function($scope, data, parse, uiUtil) {
  $scope.$on('$ionicView.enter', () =>
    setScopeData(data.getStopInfo(), data.getCauses(), data.getStations(), parse))

  const setScopeData = (train, causes, stations, p) => {
    $scope.show = {show: false}
    $scope.trainType = train.trainType
    $scope.trainNumber = train.trainNumber

    const stops =
      train.timeTableRows
      .filter(p.onlyArrivals)
      .filter(p.onlyPassengerStops)
      .map(p.addMomentTime)
      .map(p.getStationName(stations))

    const hasPassed = p.momentPassed(moment())
    const prevStops =
      stops
      .filter(hasPassed(true))
    const nextStops =
      stops
      .filter(hasPassed(false))

    const parseStopModel = row => {
      return {
        name: p.stationCodeToName(stations)(row.stationShortCode),
        shortCode: row.stationShortCode,
        time: row.time,
        track: row.commercialTrack,
        cancelled: row.cancelled,
        scheduledTime: moment(row.scheduledTime),
        timeDiff: row.differenceInMinutes,
        cause: row.causes.map(cause =>
          p.causeCodeToExplanation(causes)(cause.categoryCode))[0]
      }
    }

    $scope.prevStops = prevStops.map(parseStopModel)
    $scope.nextStops = nextStops.map(parseStopModel)

    $scope.prevStop = _.last($scope.prevStops)
    $scope.timeDiff = _.get($scope.nextStops[0], 'timeDiff')
  }

  $scope.tryFetchStationData = (station) =>
    uiUtil.getDataSetState(data.fetchStationInfo(station), "station-info")

  $scope.tryFetchTrainData = (train) =>
    uiUtil.getDataSetState(data.fetchTrainInfo(train), "train-info")
    $scope.finished = {};
})

.controller('TrainInfoCtrl', function($scope, data, parse) {
  $scope.parsed = {is: false}
  $scope.$on('$ionicView.enter', () => setScopeData(data.getTrainInfo(), parse))

  const setScopeData = (train, p) => {
    $scope.parsed = {is: false}
    $scope.trainType = train.trainType
    $scope.trainNumber = train.trainNumber

    const between = p.between(moment())
    const currentSetup =
      train.journeySections
      .map(p.addMomenTimeForJourneySection)
      .filter(section => between(section.begin, section.end))
      [0]

    if(currentSetup) {
      $scope.locomotives = currentSetup.locomotives.length
      $scope.topSpeed = currentSetup.maximumSpeed
      $scope.length = currentSetup.totalLength
      $scope.wagonAmount = currentSetup.wagons.length
      $scope.specialWagons = currentSetup.wagons.filter(p.specialWagon)
    }
    $scope.parsed = {is: true}
  }
})

.controller('StationInfoCtrl', function($scope, data, parse, uiUtil) {
  $scope.$on('$ionicView.enter', () =>
    setScopeData(data.getStationInfo(), data.getStations(), parse))

  const setScopeData = (stationData, stations, p) => {
    const notPassed = p.momentPassed(moment())(false)
    const codeToName = p.stationCodeToName(stations)
    console.log("Pre-parsed: ", stationData)
    $scope.stationName = codeToName(stationData.code)

    const model =
      stationData.trains
      .filter(p.filterNotPassengerTrains)
      .map(train => {
        const ttRows = train.timeTableRows;
        const firstStation = codeToName(_.get(ttRows, '[0].stationShortCode'))
        const lastStation = codeToName(ttRows[ttRows.length-1].stationShortCode)
        const ttRowsWithStation =
          train.timeTableRows
          .filter(p.onlyThisStation(stationData.code))
          .filter(p.onlyPassengerStops)
          .map(p.addMomentTime)
          .filter(notPassed)

        const arrivalTimes =
          ttRowsWithStation
          .filter(p.onlyArrivals)
          .map(p.addScheduledTime)
        const departureTimes =
          ttRowsWithStation
          .filter(p.onlyDeparture)
          .map(p.addScheduledTime)

        const arrivalTime = _.get(arrivalTimes[0], 'time')
        const departureTime = _.get(departureTimes[0], 'time')

        const scheduledArrival = _.get(arrivalTimes[0], 'scheduledTime')
        const scheduledDeparture = _.get(departureTimes[0], 'scheduledTime')

        const arrivalDiff = (arrivalTime && scheduledArrival) ? scheduledArrival.diff(arrivalTime) : 0
        const departureDiff = (departureTime && scheduledDeparture) ? scheduledDeparture.diff(departureTime) : 0
        //Only register over 1min differences
        const arrivesInSchedule = Math.abs(arrivalDiff) < 60000 ? true : false
        const departuresInSchedule = Math.abs(departureDiff) < 60000 ? true : false

        return {
          name: train.trainType,
          number: train.trainNumber,

          firstStation: firstStation,
          lastStation: lastStation,

          arrivesInSchedule: arrivesInSchedule,
          scheduledArrival: scheduledArrival,
          arrives: arrivalTime,
          arrivalTrack: _.get(arrivalTimes[0], 'commercialTrack'),

          departuresInSchedule: departuresInSchedule,
          scheduledDeparture: scheduledDeparture,
          departures: departureTime,
          departureTrack: _.get(departureTimes[0], 'commercialTrack')
        }
      })
      //.filter(train => train.category == p.trainCategories.longDistance)

    $scope.arrivals =
      model
      .filter(row => row.arrives)
      .sort((a, b) => p.earliestFirst(a.arrives, b.arrives))
    $scope.departures =
     model
     .filter(row => row.departures)
     .sort((a, b) => p.earliestFirst(a.departures, b.departures))
     console.log("Afterparse: arrivals: ", $scope.arrivals)
     console.log("Afterparse: departures: ", $scope.departures)
  }

  $scope.clickTrain = (trainNumber) =>
    uiUtil.getDataSetState(data.fetchStops(trainNumber), "stop-info")
})
