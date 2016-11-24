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
    console.log("before: ", train.timeTableRows)
    $scope.trainType = train.trainType
    $scope.trainNumber = train.trainNumber

    const stops =
      train.timeTableRows
      .map(p.getCauseExplanations(causes))
      .map(p.getStationName(stations))
      .map(p.addMomentTime)
      .filter(p.onlyArrivals)
      .filter(p.onlyPassengerStops)
    console.log("after", stops)
    const prevStops = stops.filter(p.passed(true))
    const nextStops = stops.filter(p.passed(false))

    console.log("prev", prevStops)
    console.log("next", nextStops)

    if(nextStops[0]) {
      $scope.timeDiff = nextStops[0].differenceInMinutes
      $scope.prevStops = prevStops;
      $scope.nextStops = nextStops;
    }
  }
})

.controller('TrainInfoCtrl', function($scope, data, parse) {
  $scope.$on('$ionicView.enter', () => setScopeData(data.getTrainInfo(), parse))

  const setScopeData = (train, p) => {
    if(train.trainType && train.trainNumber) {
      $scope.trainType = train.trainType
      $scope.trainNumber = train.trainNumber

      const betweenThese = p.betweenTimes(moment(), moment)
      const currentSetup = train.journeySections
        .filter((section) => betweenThese(p.begin(section), p.end(section)))[0]

      if(currentSetup) {
        $scope.locomotives = currentSetup.locomotives.length
        $scope.topSpeed = currentSetup.maximumSpeed
        $scope.length = currentSetup.totalLength
        $scope.wagonAmount = currentSetup.wagons.length
        $scope.specialWagons = currentSetup.wagons.filter(p.specialWagon)
      }
    } else {
    alert("VOI PERSEEN PASKA TOIMIIKO TÄMÄ OIKEASTI?? (TRAININFOCONTROLLER)")
  }

  }
})

.controller('StationInfoCtrl', function($scope, data, parse, uiUtil) {
  $scope.$on('$ionicView.enter', () => setScopeData(data.getStationInfo(), parse))

  const setScopeData = (trains, p) => {
    const notPassed = p.momentPassed(false, moment())
    const model =
      _.map(trains, train => {
        const name = train.trainType
        const number = train.trainNumber
        const ttRows =
          _.chain(train.timeTableRows)
          .filter(p.onlyThisStation)
          .filter(p.onlyPassengerStops)
          .map(p.addMomentTime)
          .filter(notPassed)
          .value()

        const arrivalTimes = _.filter(ttRows, p.onlyArrivals)
        const arrives = _.get(_.first(arrivalTimes), 'time')
        const arrivalTrack = _.get(_.first(arrivalTimes), 'commercialTrack')

        const departureTimes = _.filter(ttRows, p.onlyDeparture)
        const departures = _.get(_.first(departureTimes), 'time')
        const departureTrack = _.get(_.first(departureTimes), 'commercialTrack')

        return {"name": name, "number": number,
          "arrives": arrives, "arrivalTrack": arrivalTrack,
          "departures": departures, "departureTrack": departureTrack}
      })

    $scope.arrivals =
      _.chain(model)
      .filter(row => row.arrives)
      .sort((a, b) => p.earliestFirst2(a.arrives, b.arrives))
      .value()
    $scope.departures =
     _.chain(model)
     .filter(row => row.departures)
     .sort((a, b) => p.earliestFirst2(a.departures, b.departures))
     .value()
  }

  $scope.clickTrain = (trainNumber) =>
    uiUtil.getDataSetState(data.fetchStops(trainNumber), "stop-info")
})
