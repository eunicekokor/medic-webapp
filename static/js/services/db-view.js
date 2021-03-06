var _ = require('underscore'),
    escape = ['startkey','endkey','key'];

(function () {

  'use strict';

  var inboxServices = angular.module('inboxServices');
  
  inboxServices.factory('DbView', ['$resource', 'BaseUrlService',
    function($resource, BaseUrlService) {

      return function(viewName, options, callback) {
        var url = BaseUrlService() + '/../_view/' + viewName;
        escape.forEach(function(key) {
          if (options[key]) {
            options[key] = JSON.stringify(options[key]);
          }
        });
        options.cache = true;
        $resource(url).get(
          options,
          function(results) {
            var meta = {
              total_rows: results.total_rows,
              offset: results.offset
            };
            if (options.include_docs) {
              results = _.pluck(results && results.rows, 'doc');
            }
            callback(null, results, meta);
          },
          function(err) {
            callback(err);
          }
        );
      };

    }
  ]);

}());