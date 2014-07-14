var inboxControllers = angular.module('inboxControllers', ['ngSanitize']);

var baseUrl = $('html').data('base-url');

inboxControllers.filter('relativeDate', function () {
  return function (date) {
    if (!date) { 
      return ''; 
    }
    var m = moment(date);
    return '<span title="' + m.format('HH:mm, Do MMM YYYY') + '">' + 
      m.fromNow() + 
      '</span>';
  };
});

inboxControllers.filter('state', function () {
  return function (task) {
    if (!task || !task.state) { 
      return ''; 
    }
    var title = task.due ? moment(task.due).fromNow() : '';
    return '<span class="task-state" title="' + title + '">' + 
      task.state + 
      '</span>';
  };
});

inboxControllers.filter('messageType', function () {
  return function (message, forms) {
    if (!message || !forms) { 
      return '';
    }
    if (!message.form) {
      return 'Message';
    }
    for (var i = 0; i < forms.length; i++) {
      if (message.form === forms[i].code) {
        return forms[i].name;
      }
    }
    return message.form;
  };
});

inboxControllers.directive('mmSender', function() {
  return {
    restrict: 'E',
    scope: { message: '=' },
    templateUrl: baseUrl + '/static/js/templates/sender.html'
  };
});

inboxControllers.controller('InboxCtrl', 
  ['$scope', '$route', '$location', 'Facility', 'Settings', 
  function ($scope, $route, $location, Facility, Settings) {

    $scope.forms = [];
    $scope.facilities = [];
    $scope.selected = undefined;
    $scope.loading = true;
    $scope.appending = false;
    $scope.messages = [];
    $scope.totalMessages = undefined;

    $scope.filterModel = {
      type: 'messages',
      forms: [],
      facilities: [],
      valid: true,
      date: {
        from: moment().subtract('months', 1).valueOf(),
        to: moment().valueOf()
      }
    };

    Facility.query(function(res) {
      if (res.rows) {
        res.rows.forEach(function(clinic) {
          var entity = clinic.doc;
          var names = [];
          do {
            names.push(entity.name);
            entity = entity.parent;
          } while( entity.name );
          $scope.facilities.push({
            id: clinic.id,
            text: names.join(', ')
          });
        });
      }
    });
    Settings.query(function(res) {
      if (res.settings && res.settings.forms) {
        var forms = res.settings.forms;
        for (var key in forms) {
          var form = forms[key];
          $scope.forms.push({
            name: form.meta.label.en,
            code: form.meta.code
          });
        }
      }
    });

    $scope.setMessage = function(id) {
      $location.path('/' + $scope.filterModel.type + '/' + id);
    };

    $scope.selectMessage = function(id) {
      $scope.selected = undefined;
      _selectedDoc = id;
      if (id) {
        $scope.messages.forEach(function(message) {
          if (message._id === id) {
            $scope.selected = message;
          }
        });
      }
    };

    var _deleteMessage = function(id) {
      if ($scope.selected && $scope.selected._id === id) {
        $scope.selected = undefined;
      }
      for (var i = 0; i < $scope.messages.length; i++) {
        if (id === $scope.messages[i]._id) {
          $scope.messages.splice(i, 1);
        }
      }
    };

    var _findMessage = function(id) {
      for (var i = 0; i < $scope.messages.length; i++) {
        if (id === $scope.messages[i]._id) {
          return $scope.messages[i];
        }
      }
    };

    $scope.update = function(updated) {
      for (var i = 0; i < updated.length; i++) {
        var newMsg = updated[i];
        var oldMsg = _findMessage(newMsg._id);
        if (oldMsg) {
          if (newMsg._rev !== oldMsg._rev) {
            for (var prop in newMsg) {
              oldMsg[prop] = newMsg[prop];
            }
          }
        } else {
          $scope.messages.push(newMsg);
        }
      }
      $scope.loading = false;
      $scope.appending = false;
    };

    var _setFilterString = function() {

      var formatDate = function(date) {
        return moment(date).format('YYYY-MM-DD');
      };

      var filters = [];

      // increment end date so it's inclusive
      var to = new Date($scope.filterModel.date.to.valueOf());
      to.setDate(to.getDate() + 1);

      filters.push(
        'reported_date<date>:[' + 
        formatDate($scope.filterModel.date.from) + ' TO ' + formatDate(to) + 
        ']'
      );

      if ($scope.filterModel.type === 'messages') {
        filters.push('-form:[* TO *]');
      } else {
        if ($scope.filterModel.forms.length) {
          var formCodes = [];
          $scope.filterModel.forms.forEach(function(form) {
            formCodes.push(form.code);
          });
          filters.push('form:(' + formCodes.join(' OR ') + ')');
        } else {
          filters.push('form:[* TO *]');
        }
      }

      if ($scope.filterModel.valid === true) {
        filters.push('errors<int>:0');
      } else if ($scope.filterModel.valid === false) {
        filters.push('NOT errors<int>:0');
      }

      if ($scope.filterModel.facilities.length) {
        filters.push('clinic:(' + $scope.filterModel.facilities.join(' OR ') + ')');
      }

      $('#advanced').val(filters.join(' AND '));
    };

    var _currentQuery;
    var _selectedDoc;

    $scope.advancedFilter = function(options) {
      options = options || {};
      options.query = $('#advanced').val();
      if (options.query === _currentQuery && !options.changes) {
        // debounce as same query already running
        return;
      }
      _currentQuery = options.query;
      if (options.changes) {
        var changedRows = options.changes.results;
        for (var i = 0; i < changedRows.length; i++) {
          if (changedRows[i].deleted) {
            _deleteMessage(changedRows[i].id);
          }
        }
      }
      if (!options.silent) {
        $scope.loading = true;
      }
      if (options.skip) {
        $scope.appending = true;
        options.skip = $scope.messages.length;
      } else if (!options.silent) {
        $scope.messages = [];
      }
      options.callback = function(err, data) {
        _currentQuery = null;
        if (err) {
          return console.log(err);
        }
        angular.element($('body')).scope().$apply(function(scope) {
          scope.update(data.rows);
          scope.totalMessages = data.total_rows;
          if (_selectedDoc) {
            scope.selectMessage(_selectedDoc);
          }
        });
      };
      $('body').trigger('updateMessages', options);
    };

    $scope.filter = function(options) {
      _setFilterString();
      $scope.advancedFilter(options);
    };

    $scope.$watch('filterModel', $scope.filter, true);
    $scope.$watch('filterModel.type', function() { 
      $scope.selected = undefined; 
    });

    _setFilterString();

  }
]);

inboxControllers.controller('MessageCtrl', 
  ['$scope', '$route', 
  function ($scope, $route) {
    $scope.filterModel.type = 'messages';
    $scope.selectMessage($route.current.params.doc);
  }
]);


inboxControllers.controller('FormCtrl', 
  ['$scope', '$route', 
  function ($scope, $route) {
    $scope.filterModel.type = 'forms';
    $scope.selectMessage($route.current.params.doc);
  }
]);


inboxControllers.controller('ReportCtrl', 
  ['$scope', 
  function ($scope) {
    $scope.filterModel.type = 'reports';
    $scope.selectMessage();
    $('body').trigger('renderReports');
  }
]);