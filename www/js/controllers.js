app
.controller('ChooseCtrl', function($scope, $state, data, uiUtil) {
  $scope.train = {number: 716}
  $scope.station = {name: "HKI"}

  $scope.tryFetchStopData = (train) =>
    ($scope.train.number) ? uiUtil.getDataSetState(data.fetchStops(train), "stop-info")
      : uiUtil.toast('Antaisitko junanumeron?')

  $scope.tryFetchTrainData = (train) =>
    ($scope.train.number) ? uiUtil.getDataSetState(data.fetchTrainInfo(train), "train-info")
      : uiUtil.toast('Antaisitko junanumeron?')

  $scope.tryFetchStationData = (station) =>
    ($scope.train.number) ? uiUtil.getDataSetState(data.fetchStationInfo(station), "station-info")
      : uiUtil.toast('Antaisitko asematunnuksen?')
})

.controller('StopInfoCtrl', function($scope, data, parse) {
  $scope.$on('$ionicView.enter', () =>
    setScopeData(data.getStopInfo(), data.getCauses(), data.getStations(), parse))

  const setScopeData = (train, causes, stations, p) => {
    $scope.trainType = train.trainType
    $scope.trainNumber = train.trainNumber

    const stops =
      train.timeTableRows
      .filter(p.onlyArrivals)
      .filter(p.onlyPassengerStops)
      .map(p.addMomentTime)
      .map(p.getStationName(stations))

    const hasPassed = p.momentPassed(moment())
    const prevStops = stops.filter(hasPassed(true))
    const nextStops = stops.filter(hasPassed(false))

    const parseStopModel = row => {
      return {
        name: p.stationCodeToName(stations)(row.stationShortCode),
        time: row.time,
        track: row.commercialTrack,
        cancelled: row.cancelled,
        scheduledTime: moment(row.scheduledTime),
        timeDiff: row.differenceInMinutes,
        reasonsForBeingLate: row.causes.map(cause =>
          p.causeCodeToExplanation(causes)(cause.categoryCode))
      }
    }

    $scope.prevStops = prevStops.map(parseStopModel)
    $scope.nextStops = nextStops.map(parseStopModel)

    if (nextStops[0]) $scope.timeDiff = nextStops[0].timeDiff

    console.log("Prevstops: ", $scope.prevStops)
    console.log("Nextstops: ", $scope.nextStops)
  }
})

.controller('TrainInfoCtrl', function($scope, data, parse) {
  $scope.$on('$ionicView.enter', () => setScopeData(data.getTrainInfo(), parse))

  const setScopeData = (train, p) => {
    $scope.trainType = train.trainType
    $scope.trainNumber = train.trainNumber

    const between = p.between(moment())
    const currentSetup =
      train.journeySections
      .map(p.addMomenTimeForJourneySection)
      .filter(section => between(section.begin, section.end))
      [0]
    console.log("current setup: ", currentSetup)
    if(currentSetup) {
      $scope.locomotives = currentSetup.locomotives.length
      $scope.topSpeed = currentSetup.maximumSpeed
      $scope.length = currentSetup.totalLength
      $scope.wagonAmount = currentSetup.wagons.length
      $scope.specialWagons = currentSetup.wagons.filter(p.specialWagon)
      }
  }
})

.controller('StationInfoCtrl', function($scope, data, parse, uiUtil) {
  $scope.$on('$ionicView.enter', () =>
    setScopeData(data.getStationInfo(), data.getStations(), parse))

  const setScopeData = (trains, stations, p) => {
    const notPassed = p.momentPassed(moment())(false)
    const model =
      trains.map(train => {
        const ttRows = train.timeTableRows;
        const codeToName = p.stationCodeToName(stations)
        const firstStation = codeToName(_.get(ttRows, '[0].stationShortCode'))
        const lastStation = codeToName(ttRows[ttRows.length-1].stationShortCode)

        const ttRowsWithStation =
          train.timeTableRows
          .filter(p.onlyThisStation)
          .filter(p.onlyPassengerStops)
          .map(p.addMomentTime)
          .map(p.getStationName(stations))
          .filter(notPassed)

        const arrivalTimes = ttRowsWithStation.filter(p.onlyArrivals)
        const departureTimes = ttRowsWithStation.filter(p.onlyDeparture)

        return {
          name: train.trainType,
          number: train.trainNumber,
          firstStation: firstStation,
          lastStation: lastStation,
          arrives: _.get(arrivalTimes[0], 'time'),
          arrivalTrack: _.get(arrivalTimes[0], 'commercialTrack'),
          departures: _.get(departureTimes[0], 'time'),
          departureTrack: _.get(departureTimes[0], 'commercialTrack')
        }
      })

    $scope.arrivals =
      model
      .filter(row => row.arrives)
      .sort((a, b) => p.earliestFirst2(a.arrives, b.arrives))
    $scope.departures =
     model
     .filter(row => row.departures)
     .sort((a, b) => p.earliestFirst2(a.departures, b.departures))
  }

  $scope.clickTrain = (trainNumber) =>
    uiUtil.getDataSetState(data.fetchStops(trainNumber), "stop-info")
})
