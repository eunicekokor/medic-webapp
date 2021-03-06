var _ = require('underscore'),
    moment = require('moment'),
    stockUtils = require('../modules/stock-reporting-utils');

(function () {

  'use strict';

  var inboxServices = angular.module('inboxServices');

  inboxServices.factory('AnalyticsModules',
    ['$rootScope', '$resource', 'translateFilter', 'db', 'UserDistrict', 'District', 'DbView', 'ChildFacility', 'FormatDataRecord',
    function($rootScope, $resource, translateFilter, db, UserDistrict, District, DbView, ChildFacility, FormatDataRecord) {

      var request = function(url, district, options, callback) {
        if (!callback) {
          callback = options;
          options = {};
        }
        _.defaults(options, {
          method: 'GET',
          isArray: true,
          cache: true
        });
        $resource(url, { district: district }, { query: options }).query(
          function(data) {
            callback(null, data);
          },
          function(err) {
            console.log('Error requesting module', err);
            callback(err);
          }
        );
      };

      return function(settings) {
        var modules = [
          {
            id: 'anc',
            label: 'Antenatal Care',
            available: function() {
              return _.every([
                'registration', 'registrationLmp', 'visit', 'delivery', 'flag'
              ], function(prop) {
                var formCode = settings.anc_forms[prop];
                return !!settings.forms[formCode];
              });
            },
            render: function(scope) {

              scope.activePregnancies = { loading: true };
              scope.upcomingAppointments = { loading: true };
              scope.missedAppointments = { loading: true };
              scope.upcomingDueDates = { loading: true };
              scope.highRisk = { loading: true };
              scope.totalBirths = { loading: true };
              scope.missingDeliveryReports = { loading: true };
              scope.deliveryLocation = { loading: true };
              scope.visitsCompleted = { loading: true };
              scope.visitsDuring = { loading: true };
              scope.monthlyRegistrations = { loading: true };
              scope.monthlyDeliveries = { loading: true };
              
              UserDistrict(function(err, district) {

                if (err) {
                  return console.log('Error fetching district', err);
                }

                request('/api/active-pregnancies', district, { isArray: false }, function(err, data) {
                  scope.activePregnancies = { error: err, data: data };
                });

                request('/api/upcoming-appointments', district, function(err, data) {
                  scope.upcomingAppointments = { error: err, data: data, order: 'date' };
                });

                request('/api/missed-appointments', district, function(err, data) {
                  scope.missedAppointments = { error: err, data: data, order: 'date' };
                });

                request('/api/upcoming-due-dates', district, function(err, data) {
                  scope.upcomingDueDates = { error: err, data: data, order: 'edd' };
                });

                request('/api/high-risk', district, function(err, data) {
                  scope.highRisk = { error: err, data: data, order: 'date' };
                });

                request('/api/total-births', district, { isArray: false }, function(err, data) {
                  scope.totalBirths = { error: err, data: data };
                });

                request('/api/missing-delivery-reports', district, function(err, data) {
                  scope.missingDeliveryReports = { error: err, data: data, order: 'edd' };
                });

                var deliveryCodeMap = {
                  F: {
                    label: 'Institutional Delivery',
                    color: '#49A349'
                  },
                  S: {
                    label: 'At home with SBA',
                    color: '#D19D2E'
                  },
                  NS: {
                    label: 'At home without SBA',
                    color: '#E33030'
                  }
                };
                scope.deliveryCodeChartLabelKey = function() {
                  return function(elem) {
                    return translateFilter(deliveryCodeMap[elem.key].label);
                  };
                };
                scope.deliveryCodeChartLabelValue = function() {
                  return function(elem) {
                    return elem.value;
                  };
                };
                scope.deliveryCodeChartColors = function() {
                  return function(elem) {
                    // coloring the legend => elem
                    // coloring the chart  => elem.data
                    var data = elem.data || elem;
                    return deliveryCodeMap[data.key].color;
                  };
                };
                request('/api/delivery-location', district, function(err, data) {
                  scope.deliveryLocation = { error: err, data: data };
                });

                scope.visitsChartLabelKey = function() {
                  return function(d) {
                    return translateFilter('Number of visits', { number: d + 1 });
                  };
                };
                scope.visitsChartLabelValue = function() {
                  return function(d) {
                    return d;
                  };
                };
                var visitsMap = ['#E33030', '#DB9A9A', '#9DC49D', '#49A349'];
                scope.visitsChartColors = function() {
                  return function(d, i) {
                    return visitsMap[i];
                  };
                };

                request('/api/visits-completed', district, function(err, data) {
                  scope.visitsCompleted = {
                    error: err,
                    data: [{
                      key: 'item',
                      values: _.map(data, function(d, i) {
                        return [i, d];
                      })
                    }]
                  };
                });

                request('/api/visits-during', district, function(err, data) {
                  scope.visitsDuring = {
                    error: err,
                    data: [{
                      key: 'item',
                      values: _.map(data, function(d, i) {
                        return [i, d];
                      })
                    }]
                  };
                });

                scope.monthlyChartLabelKey = function() {
                  return function(d) {
                    return moment()
                      .subtract(12 - d, 'months')
                      .format('MMM YYYY');
                  };
                };
                scope.monthlyChartX = function() {
                  return function(d, i) {
                    return i;
                  };
                };
                scope.monthlyChartY = function() {
                  return function(d) {
                    return d.count;
                  };
                };
                scope.monthlyChartToolTip = function() {
                  return function(key, x, y) {
                    return  '<p>' +
                              translateFilter('Number in month', { count: y, month: x }) +
                            '</p>';
                  };
                };

                request('/api/monthly-registrations', district, function(err, data) {
                  scope.monthlyRegistrations = {
                    error: err,
                    data: [{
                      key: 'item',
                      values: data
                    }]
                  };
                });

                request('/api/monthly-deliveries', district, function(err, data) {
                  scope.monthlyDeliveries = {
                    error: err,
                    data: [{
                      key: 'item',
                      values: data
                    }]
                  };
                });

              });

            }
          },
          {
            id: 'stock',
            label: 'Stock Monitoring',
            available: function() {
              var forms = settings.forms;
              var stockForms = settings['kujua-reporting'];
              return _.some(stockForms, function(stockForm) {
                return !!forms[stockForm.code];
              });
            },
            render: function(scope) {

              scope.facilities = [];
              scope.districts = [];
              scope.time = { time_unit: 'month', quantity: 3 };
              scope.$watch('time', function() {
                if (scope.district) {
                  scope.setDistrict(scope.district);
                }
              }, true);

              scope.expandClinic = function(id) {
                if (scope.expandedClinic === id) {
                  scope.expandedClinic = null;
                } else {
                  scope.expandedClinic = id;
                }
              };

              scope.expandRecord = function(id) {
                if (!id) {
                  return;
                }
                if (scope.expandedRecord === id) {
                  scope.expandedRecord = null;
                } else {
                  db.getDoc(id, function(err, doc) {
                    if (err) {
                      return console.log('Error getting doc', err);
                    }
                    FormatDataRecord([{ doc: doc }], function(err, formatted) {
                      if (err) {
                        return console.log('Error formatting record', err);
                      }
                      scope.formattedRecord = formatted[0];
                      scope.expandedRecord = id;
                    });
                  });
                }
              };

              scope.setTime = function(time) {
                scope.time = time;
              };

              var colours = {
                valid: '#009900',
                invalid: '#990000',
                missing: '#999999'
              };
              scope.colorFunction = function() {
                return function(d) {
                  return colours[d.data.key];
                };
              };

              scope.setDistrict = function(district) {
                scope.district = district;
                scope.time.form = settings['kujua-reporting'][0].code;
                var dates = stockUtils.getDates(scope.time);
                db.getDoc(district.id || district._id, function(err, district) {
                  if (err) {
                    return console.log(err);
                  }
                  ChildFacility(district, function(err, facilities) {
                    if (err) {
                      return console.log(err);
                    }
                    getViewReports(DbView, district, dates, function(err, reports) {
                      scope.totals = stockUtils.getTotals(facilities, reports, dates);
                      if (district.type === 'health_center') {
                        scope.clinics = stockUtils.getRowsHC(facilities, reports, dates);
                        _.each(scope.clinics, function(f) {
                          f.chart = [
                            { key: 'valid', y: f.valid_percent },
                            { key: 'missing', y: 100 - f.valid_percent }
                          ];
                        });
                      } else {
                        scope.facilities = stockUtils.getRows(facilities, reports, dates);
                        _.each(scope.facilities, function(f) {
                          f.chart = [
                            { key: 'valid', y: f.valid_percent },
                            { key: 'missing', y: 100 - f.valid_percent }
                          ];
                        });
                      }
                      scope.chart = [
                        { key: 'valid', y: scope.totals.complete },
                        { key: 'missing', y: scope.totals.not_submitted },
                        { key: 'invalid', y: scope.totals.incomplete }
                      ];
                      scope.xFunction = function() {
                        return function(d) {
                          return d.key;
                        };
                      };
                      scope.yFunction = function() {
                        return function(d) {
                          return d.y;
                        };
                      };
                    });
                  });
                });
              };

              UserDistrict(function(err, district) {

                if (err) {
                  return console.log('Error fetching district', err);
                }

                if (district) {
                  scope.setDistrict(district);
                } else {
                  // national admin
                  District(function(err, districts) {
                    if (err) {
                      console.log(err);
                    }
                    scope.districts = districts;
                  });
                }

              });
            }
          }
        ];
        return _.filter(modules, function(module) {
          return module.available();
        });
      };
    }
  ]);

  var getViewReports = function(DbView, doc, dates, callback) {
    var args = stockUtils.getReportingViewArgs(dates),
        view = 'data_records_by_form_year_month_facility';

    if (dates.reporting_freq === 'week') {
      view = 'data_records_by_form_year_week_facility';
    }

    DbView(view, args, function(err, data) {
      if (err) {
        return callback('Error fetching reports: '+ err);
      }
      // additional filtering for this facility
      var saved_data = [];
      var idx = doc.type === 'health_center' ? 4 : 3;
      for (var i in data.rows) {
        if (doc._id === data.rows[i].key[idx]) {
          // keep orig ordering
          saved_data.unshift(data.rows[i]);
        }
      }
      callback(null, saved_data);
    });
  };

}());
