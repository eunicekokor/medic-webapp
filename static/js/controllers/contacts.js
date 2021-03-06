var _ = require('underscore'),
    async = require('async'),
    scrollLoader = require('../modules/scroll-loader');

(function () {

  'use strict';

  var inboxControllers = angular.module('inboxControllers');

  inboxControllers.controller('ContactsCtrl', 
    ['$scope', 'db', 'Search', 'DbView',
    function ($scope, db, Search, DbView) {

      $scope.filterModel.type = 'contacts';
      $scope.setContacts();

      $scope.query = function(options) {
        options = options || {};

        $scope.loading = true;
        $scope.appending = options.skip;
        $scope.error = false;

        _.defaults(options, {
          index: 'contacts',
          sort: 'name_sorting'
        });

        if (options.skip) {
          options.skip = $scope.items.length;
        }

        Search($scope, options, function(err, data) {
          $scope.loading = false;
          $scope.appending = false;
          if (err) {
            $scope.error = true;
            return console.log('Error searching for contacts', err);
          }
          $scope.totalItems = data.total_rows;
          if (options.skip) {
            $scope.items.push.apply($scope.items, data.results);
          } else {
            $scope.setContacts(data.results);
            scrollLoader.init(function() {
              $scope.query({ skip: true });
            });
          }
        });
      };

      var getContact = function(id, callback) {
        var doc = _.findWhere($scope.items, { _id: id });
        if (doc) {
          return callback(null, doc);
        }
        db.getDoc(id, callback);
      };

      $scope.selectContact = function(id) {
        if (id) {
          async.auto({
            doc: function(callback) {
              getContact(id, callback);
            },
            children: function(callback) {
              var options = {
                startkey: [ id ],
                endkey: [ id, {} ],
                include_docs: true
              };
              DbView('facility_by_parent', options, callback);
            },
            contactFor: function(callback) {
              var options = {
                key: [ id ],
                include_docs: true
              };
              DbView('facilities_by_contact', options, callback);
            }
          }, function(err, results) {
            if (err) {
              $scope.setSelected();
              return console.log('Error fetching doc', err);
            }
            results.doc.children = results.children[0];
            results.doc.contactFor = results.contactFor[0];
            $scope.setSelected(results.doc);
            $('.item-content').scrollTop(0);
          });
        } else {
          $scope.setSelected();
        }
      };

      $scope.$on('query', function() {
        $scope.query();
      });

      $scope.$on('ContactUpdated', function(e, contact) {
        if (contact && !$scope.selected) {
          return $scope.select(contact._id);
        }
        if (!contact || contact._deleted) {
          return $scope.query();
        }
        var outdated = _.findWhere($scope.items, { _id: contact._id });
        if (!outdated) {
          return $scope.query();
        }
        _.extend(outdated, contact);
      });

    }
  ]);

}());