var app = angular.module('vilniusJugApp', []);

app.controller('EventsController', function ($scope) {
  var now = new Date(); 
  var currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  $scope.upcoming = events.filter(function(event) {
    return Date.parse(event.date) >= currentDate;
  });

  $scope.past = events.filter(function(event) {
    return Date.parse(event.date) < currentDate;
  });
});

