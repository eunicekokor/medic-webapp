var _ = require('underscore');

(function () {

  'use strict';

  var inboxServices = angular.module('inboxServices');
  
  inboxServices.factory('Search', ['$resource', 'GenerateSearchQuery', 'FormatDataRecord',
    function($resource, GenerateSearchQuery, FormatDataRecord) {

      var _currentQuery;

      var debounce = function(options) {
        var queryString = JSON.stringify(options);
        if (queryString === _currentQuery) {
          // debounce as same query already running
          return true;
        }
        _currentQuery = queryString;
        return false;
      };

      var formatResults = function(data, callback) {
        FormatDataRecord(data.rows, function(err, res) {
          if (err) {
            return callback(err);
          }
          callback(null, {
            results: res,
            total_rows: data.total_rows
          });
        });
      };

      return function($scope, options, callback) {

        GenerateSearchQuery($scope, function(err, response) {
          if (err) {
            return callback(err);
          }

          if (response.query) {
            options.q = JSON.stringify(response.query);
          }
          if (response.schema) {
            options.schema = JSON.stringify(response.schema);
          }

          _.defaults(options, {
            index: 'data_records',
            limit: 50,
            sort: '\\reported_date<date>',
            include_docs: true
          });

          if (debounce(options)) {
            return;
          }

          $resource('/api/v1/fti/' + options.index).get(
            options,
            function(data) {
              _currentQuery = null;
              formatResults(data, callback);
            },
            function(err) {
              _currentQuery = null;
              callback(err);
            }
          );
        });

      };
    }
  ]);

}());