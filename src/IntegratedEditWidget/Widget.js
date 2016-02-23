///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/html',
    'dojo/dom-construct',
    'dojo/_base/array',
    'dojo/aspect',
    'dojo/i18n!esri/nls/jsapi',
    'dojo/on',
    'dojo/Deferred',
    'dojo/query',
    'dojo/dom-style',
    'dojo/dom-attr',
    'dojo/promise/all',
    "dijit/form/Button",
    "dijit/form/CheckBox",
    'esri/arcgis/Portal',
    'esri/request',
    'dijit/_WidgetsInTemplateMixin',
    'jimu/BaseWidget',
    'jimu/MapManager',
    "jimu/dijit/Message",
    'jimu/dijit/LoadingShelter',
    'esri/geometry/Point',
    'esri/geometry/Extent',
    'esri/dijit/editing/Editor',
    'esri/layers/FeatureLayer',
    'esri/dijit/Geocoder',
    'esri/urlUtils',
    'esri/graphicsUtils'
  ],
  function (declare, lang, html, domConstruct, array, aspect, esriBundle, on, Deferred, query, domStyle,domAttr, all, Button, CheckBox,arcgisPortal, esriRequest, _WidgetsInTemplateMixin,
    BaseWidget, MapManager, Message, LoadingShelter,Point, Extent, Editor, FeatureLayer, Geocoder, urlUtils, graphicsUtils) {
    return declare([BaseWidget, _WidgetsInTemplateMixin], {
      name: 'Edit',
      baseClass: 'jimu-widget-edit',
      editor: null,
      layers: null,
      _defaultStartStr: "",
      _defaultAddPointStr: "",
      resetInfoWindow: {},
      _viewMode: false,
      _editMode: false,
      _defaultMode: true,
      _loaded: false,
       _queryDefinitionApplied:false,
      _sharedInfoBetweenEdits: {
        editCount: 0,
        resetInfoWindow: null
      },
      _fieldValueMap:null,
      _defaultGeocoder:"https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer",
      postCreate: function () {
          this._setMode();
          this._setPortalGroupName();
          this._setFeatureIdentifier();
          this._setScaleLimit();
          this._setGeocoderServiceInfo();
          this._setUrlParamInfos();
          this._setPresetSourceFields();
          this._setLinkInfo();
          this.inherited(arguments);
      },
      startup: function () {
          if (this._defaultMode) {
              domConstruct.destroy(this.scaleDiv);
              domConstruct.destroy(this.editorMask);
              domConstruct.destroy(this.linksDiv);
              domStyle.set(this.editorContainer, {
                  height: "100%",
                  width: "100%"
              });
              this.editorMask = null;
          } else {
              if (this._editMode) {
                  this._updateLinksUI();
              } else {
                  domConstruct.destroy(this.linksDiv);
              }
              this._renderScaleLimitUI();
          }
          this._setupFieldValueUpdate();
          this._createLoadingShelter();
          this._setVersionTitle();
          this.inherited(arguments);
      },
      _setMode: function () {
          var urlObject = urlUtils.urlToObject(window.location.href);
          var queryObject = urlObject.query;
          if (!queryObject) {
              this._defaultMode = true;
              this._viewMode = false;
              this._editMode = false;
          } else if (queryObject.hasOwnProperty("MODE") || queryObject.hasOwnProperty("mode")) {
              var mode = queryObject['MODE'] || queryObject['mode'];
              if (mode.toLowerCase() === 'edit') {
                  this._editMode = true;
                  this._viewMode = false;
                  this._defaultMode = false;
              } else if (mode.toLowerCase() === 'view') {
                  this._viewMode = true;
                  this._editMode = false;
                  this._defaultMode = false;
              } else {
                  this._defaultMode = true;
                  this._viewMode = false;
                  this._editMode = false;
              }
          } else {
              this._defaultMode = true;
              this._viewMode = false;
              this._editMode = false;
          }
      },
      _setPortalGroupName:function(){
          this._defaultPortalGroupName = this.config.portalGroupName;
      },

      _setFeatureIdentifier:function(){
          this._featureIdentifierField = this.config.featureIdentifierField;
      },
      _setScaleLimit: function () {
          this._editScaleLimit = this.config.editScaleLimit || null;
      },
      _setGeocoderServiceInfo:function(){
          this._geocoder = {};
          this._geocoder = this.config.geocoderService ? this.config.geocoderService : this._defaultGeocoder;
      },
      _setUrlParamInfos:function(){
          var paramInfos = this.config.urlParamInfos;
          array.forEach(paramInfos,lang.hitch(this,function (infos) {
              this[infos.paramName] = infos.urlTag;
          }));
      },
      _setPresetSourceFields:function(){
          this._presetFields = this.config.presetSourceFields || [];
      },
      _setLinkInfo:function(){
          this._links = this.config.links || [];
      },
      onOpen: function () {
          if (this._viewMode || this._editMode) {
              if (this._loaded) {
                  this._setUpEditor();
              } else {
                  if (this._isPortalGroupFromUrl()) {
                      this._initialisePortalAPIInstance().then(lang.hitch(this, function () {
                          this._addToConfig(this._getPortalGroupFromUrl()).then(lang.hitch(this, function () {
                              this._loaded = true;
                              this._updateDefinitionQueryInConfig();
                              this._setUpEditor();
                          }));
                      }));
                  } else {
                      this._loaded = true;
                      this._updateDefinitionQueryInConfig();
                      this._setUpEditor();
                  }
              }
          } else {
              this._setUpEditor();
          }
      },
      _setUpEditor:function(){
          this.layers = [];
          this.disableWebMapPopup();
          this.first = true;
          this.getLayers();
          if (this._isFeatureIdentifierConfigured() && !(this._queryDefinitionApplied)) {
              var defExpressionDeferred = [];
              array.forEach(this.config.editor.layerInfos, lang.hitch(this, function (info) {
                  var layer = this.getLayerFromMap(info.featureLayer.url);
                  if (layer && info.defQuery) {
                      if (layer.visible) {
                          defExpressionDeferred.push(this._setLayerDefinitions(layer, info));
                      } else {
                          layer.setDefinitionExpression(info.defQuery);
                      }
                  }
              }));
              all(defExpressionDeferred).then(lang.hitch(this, function () {
                  this._queryDefinitionApplied = true;
                  this._showLoading();
                  this._updateMapToEditableGraphicsExtent().then(lang.hitch(this, function () {
                      this._hideLoading();
                      this.initEditor();
                  }));
              }));
              if (defExpressionDeferred.length == 0) {
                  this.initEditor();
              }
          } else {
              this.initEditor();
          }
          
      },
      _setLayerDefinitions:function(layer,info){
          var deferred = new Deferred();
          if (layer.loaded) {
              layer.setDefinitionExpression(info.defQuery);
              on.once(layer, "update-end", function () {
                  deferred.resolve();
              });
          } else {
              //non loaded layers means those layers which are not the part of the webmap and are currently added from config
              //so when they are added from config,the layer definitions queries are already applied as part of the construction options
              //hence there is no need of setting def expressions here.Hence listen for the "update-end" event to resolve that deferred 
              on.once(layer, "update-end", function () {
                  deferred.resolve();
              });
          }
          return deferred.promise;
      },
      disableWebMapPopup: function() {
        var mapManager = MapManager.getInstance();

        mapManager.disableWebMapPopup();
        // change to map's default infowindow(popup)
        var mapInfoWindow = mapManager.getMapInfoWindow();
        if (mapManager.isMobileInfoWindow) {
          this.map.setInfoWindow(mapInfoWindow.bigScreen);
          mapManager.isMobileInfoWindow = false;
        }

        // instead of Mapmanager.resetInfoWindow by self resetInfoWindow
        if (this._sharedInfoBetweenEdits.resetInfoWindow === null) {
          this._sharedInfoBetweenEdits.resetInfoWindow = mapManager.resetInfoWindow;
          this.own(on(this.map.infoWindow, "show", lang.hitch(this, function() {
            if (window.appInfo.isRunInMobile) {
              this.map.infoWindow.maximize();
            }
          })));
        }
        mapManager.resetInfoWindow = lang.hitch(this, function() {});

        this._sharedInfoBetweenEdits.editCount++;
      },

      enableWebMapPopup: function() {
        var mapManager = MapManager.getInstance();

        // recover restInfoWindow when close widget.
        this._sharedInfoBetweenEdits.editCount--;
        if (this._sharedInfoBetweenEdits.editCount === 0 &&
          this._sharedInfoBetweenEdits.resetInfoWindow) {
          // edit will change infoWindow's size, so resize it.
          mapManager.getMapInfoWindow().bigScreen.resize(270, 316);
          mapManager.resetInfoWindow =
            lang.hitch(mapManager, this._sharedInfoBetweenEdits.resetInfoWindow);
          this._sharedInfoBetweenEdits.resetInfoWindow = null;
          mapManager.resetInfoWindow();
          mapManager.enableWebMapPopup();
        }
      },

      getLayerFromMap: function (url) {
        var ids = this.map.graphicsLayerIds;
        var len = ids.length;
        for (var i = 0; i < len; i++) {
            var layer = this.map.getLayer(ids[i]);
          if (layer.url === url) {
              return layer;
          }
        }
        return null;
      },

      getLayers: function() {
        var layerInfos;

        if(!this.config.editor.layerInfos) {
          // configured in setting page and no layers checked.
          layerInfos = [];
        } else if(this.config.editor.layerInfos.length > 0)  {
          // configured and has layer checked.
          layerInfos = this.config.editor.layerInfos;
        } else {
          // does not configure.
          layerInfos = this._getDefaultLayerInfos();
        }

        for (var i = 0; i < layerInfos.length; i++) {
          var featureLayer = layerInfos[i].featureLayer;
          var layer = this.getLayerFromMap(featureLayer.url);
          if (!layer) {
              if (!layerInfos[i].featureLayer.options) {
                  layerInfos[i].featureLayer.options = {};
              }
              if (!layerInfos[i].featureLayer.options.outFields) {
                  if (layerInfos[i].fieldInfos) {
                      layerInfos[i].featureLayer.options.outFields = [];
                      for (var j = 0; j < layerInfos[i].fieldInfos.length; j++) {
                          layerInfos[i].featureLayer.options
                            .outFields.push(layerInfos[i].fieldInfos[j].fieldName);
                      }
                  } else {
                      layerInfos[i].featureLayer.options.outFields = ["*"];
                  }
              }
              //if (layerInfos[i].defQuery) {
              //    featureLayer.options.definitionExpression = layerInfos[i].defQuery;
              //}
              layer = new FeatureLayer(featureLayer.url, featureLayer.options);

              this.map.addLayer(layer);
              layer.fromPortalGroup = layerInfos[i].fromPortalGroup;
          } else {
              //if (layerInfos[i].defQuery) {
              //    layer.setDefinitionExpression(layerInfos[i].defQuery);
              //}
          }
          if (layer.visible) {
            layerInfos[i].featureLayer = layer;
            this.layers.push(layerInfos[i]);
          }
        }
      },

      _getDefaultLayerInfos: function() {
        var defaultLayerInfos = [];
        for(var i = 0; i < this.map.graphicsLayerIds.length; i++) {
          var layer = this.map.getLayer(this.map.graphicsLayerIds[i]);
          if (layer.type === "Feature Layer" && layer.url && layer.isEditable()) {
            var layerInfo = {
              featureLayer: {}
            };
            layerInfo.featureLayer.url = layer.url;
            layerInfo.disableGeometryUpdate = false;
            layerInfo.fieldInfos = this._getDefaultFieldInfos(layer);
            if (!layerInfo.fieldInfos || !layerInfo.fieldInfos.length) {
              delete layerInfo.fieldInfos;
            }
            defaultLayerInfos.push(layerInfo);
          }
        }
        return defaultLayerInfos;
      },

      _getDefaultFieldInfos: function(layer) {
        var fields = [];
        var count = layer.fields.length;
        for (var m = 0; m < count; m++) {
          if (!layer.fields[m].alias) {
            layer.fields[m].alias = layer.fields[m].name;
          }
          fields.push({
            fieldName: layer.fields[m].name,
            label: layer.fields[m].alias,
            isEditable: true
          });
        }
      },

      initEditor: function() {
        this._defaultStartStr = esriBundle.toolbars.draw.start;
        esriBundle.toolbars.draw.start = esriBundle.toolbars.draw.start +
          "<br/>" + "(" + this.nls.pressStr + "<b>" +
          this.nls.ctrlStr + "</b> " + this.nls.snapStr + ")";
        this._defaultAddPointStr = esriBundle.toolbars.draw.addPoint;
        esriBundle.toolbars.draw.addPoint = esriBundle.toolbars.draw.addPoint +
          "<br/>" + "(" + this.nls.pressStr + "<b>" +
          this.nls.ctrlStr + "</b> " + this.nls.snapStr + ")";
        var json = this.config.editor;
        var settings = {};
        for (var attr in json) {
          settings[attr] = json[attr];
        }
        settings.layerInfos = this.layers;
        settings.map = this.map;

        var params = {
          settings: settings
        };

        if (!this.editDiv) {
              this.editDiv = html.create("div", {
                style: {
                  width: "100%",
                  height: "100%"
                }
              });
              html.place(this.editDiv, this.editorContainer);
        }

       

        // var styleNode =
        // html.toDom("<style>.jimu-widget-edit .grid{height: " + (height - 60) + "px;}</style>");
        // html.place(styleNode, document.head);
        this.editor = new Editor(params, this.editDiv);
        this.editor.startup();

        if (this._editMode) {
            this._editAspectHandler = aspect.before(this.editor.editToolbar, "activate", lang.hitch(this, function (a, graphic) {
                var attributeInspector = this.editor.attributeInspector;
                if (!this._customSaveBtnRendered) {
                    //add a save button next to the delete button
                    var saveButton = new Button({ label: "Save", "style":  "margin:0px !important;" }, domConstruct.create("div"));
                    domConstruct.place(saveButton.domNode, attributeInspector.deleteBtn.domNode, "after");
                    saveButton.on("click", lang.hitch(this, function () {
                        var updateFeature = this.editor.editToolbar.getCurrentState().graphic;
                        attributeInspector.onAttributeChange(updateFeature);
                        this.editor.stopEditing();
                    }));
                    this._customSaveBtnRendered = true;
                }
                if (this._fieldValueMap) {
                    var fields = Object.keys(this._fieldValueMap) || [];
                    var attributes = Object.keys(graphic.attributes) || [];
                    if (attributes.length > 0 && fields.length > 0) {
                        array.forEach(fields,lang.hitch(this,function (field) {
                            if (array.indexOf(attributes, field) >= 0) {
                                graphic.attributes[field] = this._fieldValueMap[field];
                            }
                        }));
                    }
                }
                var attributeInspector = this.editor.attributeInspector;
                attributeInspector.refresh();
            }));
        } 
        if (!this._defaultMode && this._editScaleLimit) {
            this._scaleCheck = this.map.on("zoom-end", lang.hitch(this, "_updateEditorState"));
            this._updateEditorState();
        }
        setTimeout(lang.hitch(this, this.resize), 100);
      },
      onMaximize: function() {
        setTimeout(lang.hitch(this, this.resize), 100);
      },

      onClose: function() {
        if (this.editor) {
            this.editor.destroy();
            if (this._editAspectHandler) {
                this._editAspectHandler.remove();
            }
            this._customSaveBtnRendered = false;
        }
        if (this._scaleCheck) {
            this._scaleCheck.remove();
        }
        this.enableWebMapPopup();
        this.layers = [];
        this.editor = null;
        this.editDiv = html.create("div", {
          style: {
            width: "100%",
            height: "100%"
          }
        });
        html.place(this.editDiv, this.editorContainer);
        esriBundle.toolbars.draw.start = this._defaultStartStr;
        esriBundle.toolbars.draw.addPoint = this._defaultAddPointStr;
      },

      resize: function () {
          var widgetBox = html.getMarginBox(this.editorContainer);
        var height = widgetBox.h;
        var width = widgetBox.w;

        if(this.editor){
          this.editor.templatePicker.update();
        }

        //query(".esriEditor", this.domNode).style('height', height + 'px');
        query(".templatePicker", this.editorContainer).style('height', height - 60 + 'px');
        query(".grid", this.editorContainer).style('height', height - 70 + 'px');
        query(".dojoxGridView", this.editorContainer).style('height', height - 70 + 'px');
        query(".dojoxGridScrollbox", this.editorContainer).style('height', height - 70 + 'px');

        query(".dojoxGridRowTable", this.editorContainer).style('width', width - 32 + 'px');
        if (this.editorMask) {
            domStyle.set(this.editorMask, {
                'height': (height - 30) + "px",
                'bottom': domStyle.get(this.editorContainer,"bottom")
            });
        }
      },
      _isPortalGroupFromUrl: function () {
            var urlObject = urlUtils.urlToObject(window.location.href);
            var queryObject = urlObject.query;
            var inPortalGrp = false;
            if(queryObject && this.portalGroupNameIdentifier){
                if(queryObject.hasOwnProperty(this.portalGroupNameIdentifier)){
                    inPortalGrp = true;
                }else{
                    inPortalGrp = false;
                }
            }else{
                inPortalGrp = false;
            }
            return inPortalGrp;
      },
      _getPortalGroupFromUrl:function(){
          var urlObject = urlUtils.urlToObject(window.location.href);
          var queryObject = urlObject.query;
          return queryObject[this.portalGroupNameIdentifier];
      },
      _initialisePortalAPIInstance: function () {
          var deferred = new Deferred();
          this.portal = new arcgisPortal.Portal(this.appConfig.portalUrl);
          this.portal.on("load", function () {
              deferred.resolve();
          }, lang.hitch(this, function () {
              this.portal = null;
              deferred.resolve();
          }));
          return deferred.promise;
      },
      _addToConfig: function (grpName) {
         var deferred = new Deferred();
         var params = {
             q: 'title: ' + grpName
         };
         this.portal.queryGroups(params).then(lang.hitch(this, function (groups) {
             var grp = groups.results[0];
             if (grp) {
                 var params = {
                     q: 'type:"Feature Service"'
                 };
                 grp.queryItems(params).then(lang.hitch(this, function (resp) {
                     if (!this.config.editor.layerInfos) {
                         this.config.editor.layerInfos = [];
                     }
                     var serverInfoRequestDeferred = [];
                     array.forEach(resp.results, lang.hitch(this, function (layerInfo) {
                         var layerUrl = layerInfo.url;
                         var layerId = layerUrl.substr(layerUrl.lastIndexOf('/') + 1);
                        
                         var regExp = /\d+/g;
                         if (regExp.test(layerId)) {
                             var layerConfig = {
                                 "featureLayer": {
                                     "url": layerInfo.url,
                                     "title": layerInfo.title || layerInfo.name
                                 },
                                 "disableGeometryUpdate": false,
                                 "fromPortalGroup": true,
                                 "fieldInfos": []
                             };
                             if (!(this.isLayerInConfig(layerConfig))) {
                                 this.config.editor.layerInfos.push(layerConfig);
                             }
                             
                         } else {
                             serverInfoRequestDeferred.push(this._requestServerResourceInfo(layerInfo))
                         }
                     }));
                     if (serverInfoRequestDeferred.length > 0) {
                         all(serverInfoRequestDeferred).then(lang.hitch(this, function (infoArray) {
                             array.forEach(infoArray, lang.hitch(this, function (info) {
                                 if (info.layers && info.layers.length > 0) {
                                     array.forEach(info.layers, lang.hitch(this, function (layerObj) {
                                         var layerConfig = {
                                             "featureLayer": {
                                                 "url": info.serviceUrl + "/" + layerObj.id,
                                                 "title": layerObj.name
                                             },
                                             "disableGeometryUpdate": false,
                                             "fromPortalGroup": true,
                                             "fieldInfos": []
                                         };
                                         if (!(this.isLayerInConfig(layerConfig))) {
                                             this.config.editor.layerInfos.push(layerConfig);
                                         }
                                     }));
                                 }
                             }))
                             this._populateFieldConfig().then(function () {
                                 deferred.resolve();
                             })
                         }));

                     } else {
                         this._populateFieldConfig().then(function () {
                             deferred.resolve();
                         })
                     }
                 }));
             } else {
                 deferred.resolve();
             }

         }));
         return deferred.promise;
        
      },
      _requestServerResourceInfo: function (item) {
          var url = item.url;
          var deferred = new Deferred();
          var infoRequest = esriRequest({
              url: url,
              content: {
                  f: 'json'
              },
              handleAs: 'json',
              callbackParamName: "callback"
          });
          infoRequest.then(function (info) {
              info.serviceUrl = url;
              deferred.resolve(info)
          }, function (err) {
              deferred.reject(err);
          });
          return deferred.promise;
      },
      _isFeatureIdentifierConfigured:function(){
          var urlObject = urlUtils.urlToObject(window.location.href);
          var queryObject = urlObject.query;
          var defQueryConfigured = false;
          if (queryObject && this.featureIdentifier) {
              if (queryObject.hasOwnProperty(this.featureIdentifier) && queryObject[this.featureIdentifier]) {
                  defQueryConfigured = true;
              } else {
                  defQueryConfigured = false;
              }
          } else {
              defQueryConfigured = false;
          }
          return defQueryConfigured;
      },
      _getDefinitionQuery:function(){
          var urlObject = urlUtils.urlToObject(window.location.href);
          var queryObject = urlObject.query;
          var queryValue = queryObject[this.featureIdentifier];
          if (queryValue && isNaN(queryValue)) {
              //return this._featureidentifierfield + " like '%" + queryvalue + "%'";
              return this._featureIdentifierField + " = '" + queryValue + "'";
          } else if (queryValue) {
              return this._featureIdentifierField + " = " + queryValue;
          } else {
              return null;
          }
      },
      _updateDefinitionQueryInConfig: function () {
          if (this._isFeatureIdentifierConfigured()) {
              var query = this._getDefinitionQuery();
              array.forEach(this.config.editor.layerInfos, lang.hitch(this, function (info) {
                  if (!(info.defQuery) && query) {
                      info.defQuery = query;
                      info.defQueryApplied = false;
                  }
              }));
              this._queryDefinitionApplied = false;
          }
          
      },
      isLayerInConfig: function (layerConfig) {
          if (this.config.editor.layerInfos) {
              var info = this.config.editor.layerInfos;
              var len = info.length;
              for (var i = 0; i < len; i++) {
                  if (info[i].featureLayer && info[i].featureLayer.url && layerConfig.featureLayer) {
                      if (info[i].featureLayer.url.toLowerCase() === layerConfig.featureLayer.url.toLowerCase()) {
                          return true;
                      }
                  }
              }
          }
          return false;
      },
      _populateFieldConfig: function () {
          var deferred = new Deferred();
          var fieldConfigDeferred = [];
          array.forEach(this.config.editor.layerInfos, lang.hitch(this,function (info) {
              if (!(info.fieldInfos)) {
                  info.fieldInfos = [];
              }
              if (info.featureLayer && info.fieldInfos.length == 0) {
                  fieldConfigDeferred.push(this._getFieldConfig(info.featureLayer.url))
              }
          }));
          if (fieldConfigDeferred.length > 0) {
              all(fieldConfigDeferred).then(lang.hitch(this, function (fieldInfos) {
                  array.forEach(this.config.editor.layerInfos, function (info, index) {
                      info.fieldInfos = fieldInfos[index];
                  })
                  deferred.resolve();
              }));
          } else {
              deferred.resolve();
          }
          return deferred.promise;
      },
      _getFieldConfig: function (url) {
          var deferred = new Deferred();
          var layer = new FeatureLayer(url);
          layer.on("load", function (layer) {
              var fieldConfig = [];
              array.forEach(layer.fields, function (field) {
                  fieldConfig.push({
                      "fieldName": field.name,
                      "label": field.alias,
                      "isEditable": field.editable
                  })
              })
              deferred.resolve(fieldConfig);
          });
          layer.on("error", function (error) {
              deferred.resolve([]);
          })
          return deferred.promise;
      },
      _isFallbackAddressConfigured: function () {
          var urlObject = urlUtils.urlToObject(window.location.href);
          var queryObject = urlObject.query;
          var fallbackAddressConfigured = false;
          if (queryObject && this.featureIdentifier) {
              if (queryObject.hasOwnProperty(this.fallbackAddressIdentifier) && queryObject[this.fallbackAddressIdentifier]) {
                  fallbackAddressConfigured = true;
              } else {
                  fallbackAddressConfigured = false;
              }
          } else {
              fallbackAddressConfigured = false;
          }
          return fallbackAddressConfigured;
      },
      _getFallbackAddress:function(){
          var urlObject = urlUtils.urlToObject(window.location.href);
          var queryObject = urlObject.query;
          return queryObject[this.fallbackAddressIdentifier];
      },
      _isEditFieldsValueConfigured:function(){
          var urlObject = urlUtils.urlToObject(window.location.href);
          var queryObject = urlObject.query;
          var _sfvConfigured = false;
          if (queryObject && this.fieldValueIdentifier) {
              if (queryObject.hasOwnProperty(this.fieldValueIdentifier) && queryObject[this.fieldValueIdentifier]) {
                  _sfvConfigured = true;
              } else {
                  _sfvConfigured = false;
              }
          } else {
              _sfvConfigured = false;
          }
          return _sfvConfigured;
      
      },
      _getEditFieldAndValues:function(){
          var urlObject = urlUtils.urlToObject(window.location.href);
          var queryObject = urlObject.query;
          return queryObject[this.fieldValueIdentifier];
      },
      _updateMapToEditableGraphicsExtent: function () {
          var mapExtent;
          var deferred = new Deferred();
          array.forEach(this.config.editor.layerInfos, lang.hitch(this, function (info) {
              var layer = this.getLayerFromMap(info.featureLayer.url);
              if (layer && layer.visible && layer.graphics.length > 0) {
                  if (mapExtent) {
                      mapExtent = mapExtent.union(graphicsUtils.graphicsExtent(layer.graphics))
                  } else {
                      mapExtent = graphicsUtils.graphicsExtent(layer.graphics);
                  }
              }
          }));
          if (mapExtent) {
              var xMin = mapExtent.xmin - 1500;
              var yMin = mapExtent.ymin- 1500;
              var xMax = mapExtent.xmax + 1500;
              var yMax = mapExtent.ymax + 1500;
              var newExtent = new Extent(xMin, yMin, xMax, yMax,this.map.spatialReference)
              this.map.setExtent(newExtent,true).then(lang.hitch(this, function () {
                  this.resize();
                  deferred.resolve();
              }));
          } else {
              if (this._isFallbackAddressConfigured()) {
                  var address = this._getFallbackAddress();
                  var infoRequest = esriRequest({
                      url: this._geocoder + "/findAddressCandidates",
                      content: {
                          f: 'json',
                          SingleLine:address,
                          outSR:this.map.spatialReference.wkid,
                          outFields:"*",
                          maxLocations:10
                      },
                      handleAs: 'json',
                      callbackParamName: "callback"
                  });
                  infoRequest.then(lang.hitch(this, function (info) {
                      var candidates = array.filter(info.candidates, function (candidate) {
                          return (candidate.score == 100) && (candidate.attributes["Addr_type"] == "PointAddress")
                      });
                      if (candidates.length == 0) {
                          var popup = new Message({
                              message: this.nls.emptyGeocoderResponse,
                              buttons: [{
                                  label: this.nls.ok,
                                  onClick: lang.hitch(this, function () {
                                      popup.close();
                                  })
                              }]
                          });
                          deferred.resolve();
                      } else if (candidates.length == 1) {
                          var candidate =candidates[0];
                          var x = candidate.location.x;
                          var y = candidate.location.y;
                          if (isNaN(x) || isNaN(y)) {
                              var popup = new Message({
                                  message: this.nls.emptyGeocoderResponse,
                                  buttons: [{
                                      label: this.nls.ok,
                                      onClick: lang.hitch(this, function () {
                                          popup.close();
                                      })
                                  }]
                              });
                              deferred.resolve();
                          }else{
                              var extent = this._pointToExtent(new Point({ x: x, y: y, spatialReference: { wkid: this.map.spatialReference.wkid } }), this.map,1);
                              this.map.setExtent(extent).then(function () {
                                  deferred.resolve();
                              });
                          
                          }
                      } else if(candidates.length > 1){
                      
                          var popup = new Message({
                              message: this.nls.multipleGeocoderResponse,
                              buttons: [{
                                  label: this.nls.ok,
                                  onClick: lang.hitch(this, function () {
                                      popup.close();
                                  })
                              }]
                          });
                          deferred.resolve();

                      }
                  }), function (err) {
                      deferred.reject(err);
                  });
              } else {
                  var popup = new Message({
                      message: this.nls.noFallbackAddressConfigured,
                      buttons: [{
                          label: this.nls.ok,
                          onClick: lang.hitch(this, function () {
                              popup.close();
                          })
                      }]
                  });
                  deferred.resolve();
              }
          }
          return deferred.promise;
      },
      _renderScaleLimitUI: function () {
          if (!(this._editScaleLimit)) {
              domConstruct.destroy(this.scaleDiv);
              domConstruct.destroy(this.editorMask);
              this.editorMask = null;
          } else {
              if (this.linksDiv) {
                  var linksDivHeight = domStyle.get(this.linksDiv, "height");
                  var scaleDivHeight = domStyle.get(this.scaleDiv, "height");
                  domStyle.set(this.editorContainer, {
                      'bottom': (linksDivHeight + scaleDivHeight + 15) + "px"
                  }
                  );
                  domStyle.set(this.scaleDiv, {
                      'bottom': linksDivHeight + "px"
                  }
                 );
              }
              this.editScaleLimit.innerHTML =  "<b> 1 : " + this._editScaleLimit + "</b>";
              domAttr.set(this.editScaleLimit, "title", "1 : " + this._editScaleLimit);
              var maskHeight = domStyle.get(this.editorContainer, "height") + 15;
              domStyle.set(this.editorMask, {
                  'bottom': (linksDivHeight + scaleDivHeight) + "px",
                  'height': maskHeight + "px"
              }
              );

          }
      },
      _updateLinksUI: function () {
          if (!this._links || this._links.length == 0) {
              domConstruct.destroy(this.linksDiv);
          } else {
             
              var linkHeight = 25;
              var linksCntrHeight = (linkHeight) * (this._links.length);
              domStyle.set(this.editorContainer,
                   {
                       'bottom': (linksCntrHeight+15)+"px"
                   }
               );
              array.forEach(this._links, lang.hitch(this, function (linkConfig) {
                  var link = domConstruct.create("div", {
                      style: "color:blue;text-decoration:underline;cursor:pointer;position:relative;float:left;width:100%;height:" + linkHeight + "px;line-height:" + linkHeight+"px;",
                      innerHTML: linkConfig.title,
                      onclick: lang.hitch(this, function () {
                          this._updateIntegration(linkConfig.href);
                      })
                  });
                  domConstruct.place(link, this.linksDiv);
              }));
              domStyle.set(this.linksDiv,
                  {
                      'height': linksCntrHeight+"px",
                      'bottom' : "0px"
                  }
              );
              this.resize();
          }
      },
      _setupFieldValueUpdate: function () {
          if (this._editMode) {
              this._fieldValueMap = {}
              if (this._isEditFieldsValueConfigured()) {
                  var fieldValueString = this._getEditFieldAndValues();
                  var fieldValuePairs = fieldValueString.split(",");
                  var nonPipedAttributeIndex = 0;
                  array.forEach(fieldValuePairs, lang.hitch(this, function (pipedFieldValue, index) {
                      var regExp = new RegExp(/\|/g);
                      if (regExp.test(pipedFieldValue)) {
                          var fieldValueArray = pipedFieldValue.split("|");
                          this._fieldValueMap[lang.trim(fieldValueArray[0])] = lang.trim(fieldValueArray[1]);
                      } else {
                          if (this._presetFields.length > 0) {
                              array.forEach(this._presetFields, lang.hitch(this, function (presetField) {
                                  array.indexOf(Object.keys(this._fieldValueMap), presetField)
                              }));
                              this._fieldValueMap[lang.trim(this._presetFields[nonPipedAttributeIndex])] = lang.trim(pipedFieldValue);
                              nonPipedAttributeIndex++;
                          }
                      }
                  }));
              }
              //FID field value also be populated while editing or adding
              var urlObject = urlUtils.urlToObject(window.location.href);
              var queryObject = urlObject.query;
              if (this.featureIdentifier) {
                  var queryValue = queryObject[this.featureIdentifier];
                  if (queryValue) {
                      this._fieldValueMap[this._featureIdentifierField] = queryValue;
                  }
              }
          }
      },
      _suspendEditor: function () {
          domStyle.set(this.editorMask, "display", "block");
          if (this.editor._currentGraphic) {
              this.editor.stopEditing();
          }
          if (this.editor.drawingToolbar) {
              this.editor.drawingToolbar.deactivate();
          }
          if (this.editor.editToolbar) {
              this.editor.editToolbar.deactivate();
          }
          this.editor._disableMapClickHandler();
      },
      _resumeEditor:function(){
          domStyle.set(this.editorMask, "display", "none");
          this.editor._enableMapClickHandler();
      },
      _updateEditorState: function () {
          if (this.map.getScale() > this._editScaleLimit) {
              if (!(this.scaleLimitOverride.get("checked")) && !(this._suspended)) {
                  this._suspended = true;
                  this._suspendEditor();
              } else if (this.scaleLimitOverride.get("checked") && this._suspended) {
                  this._suspended = false;
                  this._resumeEditor();
              }
          } else {
              if (this._suspended) {
                  this._suspended = false;
                  this._resumeEditor();
              }
          }
      },
      _pointToExtent: function (point, map,tolerance) {
          // Need to specify a pixel tolerance
          var toleranceInPixel = tolerance || 12; // Can make this configurable later if needed

          //calculate map coords represented per pixel
          var pixelWidth = map.extent.getWidth() / map.width;

          //calculate map coords for tolerance in pixel
          var toleranceInMapCoords = toleranceInPixel * pixelWidth;

          var xMin = point.x - toleranceInMapCoords;
          var yMin = point.y - toleranceInMapCoords;
          var xMax = point.x + toleranceInMapCoords;
          var yMax = point.y + toleranceInMapCoords;

          //calculate & return computed extent
          var extent = new Extent(xMin, yMin, xMax, yMax, map.spatialReference);

          return extent;
      },
      _createLoadingShelter: function () {
          this.shelter = new LoadingShelter({
              hidden: true
          });
          this.shelter.placeAt(this.domNode);
          this.shelter.startup();
      },
      _showLoading:function(){
          this.shelter.show() 
      },
      _hideLoading:function(){
           this.shelter.hide();
      },
      _updateIntegration: function (url) {
          var urlObject = urlUtils.urlToObject(window.location.href);
          var queryObject = urlObject.query;
          var queryValue = "";
          if (this.featureIdentifier) {
              queryValue = queryObject[this.featureIdentifier];
          }
          url = url.replace(/\{([a-zA-Z]+)\}/g,lang.hitch(this, function (match) {
              var token = match.replace(/\{|\}/g, "");
              if (token === this.featureIdentifier) {
                  return queryValue
              }
          }));
          //window.open(url, "_blank");
          window.open(url,"_self");
      },
      _setVersionTitle: function () {
          var labelNode = this._getLabelNode(this);
          var manifestInfo = this.manifest;
          var devVersion = manifestInfo.version;
          var devWabVersion = manifestInfo.developedAgainst || manifestInfo.wabVersion;
          var client = manifestInfo.client;
          var title = "Dev version: " + devVersion + "\n";
          title += "Developed/Modified against: WAB" + devWabVersion + "\n";
          title += "Client: " + client;
          if (labelNode) {
              domAttr.set(labelNode, 'title', title);
          }
     },
      _getLabelNode: function (widget) {
          var labelNode;
          if (!(widget.labelNode) && !(widget.titleLabelNode) ) {
              if (widget.getParent()) {
                  labelNode = this._getLabelNode(widget.getParent());
              }
          } else {
              labelNode = widget.labelNode || widget.titleLabelNode;
          }
          return labelNode;
        
        }
    });
  });

