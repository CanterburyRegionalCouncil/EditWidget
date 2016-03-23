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
    'dijit/_WidgetsInTemplateMixin',
    'jimu/BaseWidgetSetting',
    './SimpleTable',
    'esri/arcgis/Portal',
    'esri/request',
    'esri/layers/FeatureLayer',
    'dojo/on',
    'dojo/promise/all',
    'dojo/Deferred',
    'dojo/_base/html',
    'dojo/on',
    'dojo/_base/array',
    "dojo/dom-style",
    "dojo/dom-construct",
    "dojo/query"
  ],
  function(
    declare,
    lang,
    _WidgetsInTemplateMixin,
    BaseWidgetSetting,
    Table,
    arcgisPortal,
    esriRequest,
    FeatureLayer,
    on,
    all,
    Deferred,
    html,
    on,
    array,
    domStyle,
    domConstruct,
    query) {
    return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
      //these two properties is defined in the BaseWidget
      baseClass: 'jimu-widget-edit-setting',
      selectLayer: null,
      tooltipDialog: null,
      portal:null,
      featurelayers: [],
      indexLayer: -1,

      // destroy: function() {
      //   this.inherited(arguments);
      //   this.indexLayer = -1;
      // },

      startup: function() {
        this.inherited(arguments);
        this.featurelayers.length = 0;
        if (!this.config.editor) {
          this.config.editor = {};
        }
        // this.tooltipDialog = new TooltipDialog({
        //   style: "width: 500px;",
        //   content: "",
        //   onMouseLeave: function() {
        //     popup.close(this.tooltipDialog);
        //   }
        // });

        this.enableUndoRedo.set('checked', this.config.editor.enableUndoRedo);
        this.toolbarVisible.set('checked', this.config.editor.toolbarVisible);
        this.mergeVisible.set('checked', this.config.editor.toolbarOptions.mergeVisible);
        this.cutVisible.set('checked', this.config.editor.toolbarOptions.cutVisible);
        this.reshapeVisible.set('checked', this.config.editor.toolbarOptions.reshapeVisible);
        this.onToolbarSelected();

        var fields = [{
          name: 'edit',
          title: this.nls.edit,
          type: 'checkbox',
          'class': 'editable'
        }, {
          name: 'label',
          title: this.nls.label,
          type: 'text'
        }, {
          name: 'disableGeometryUpdate',
          title: this.nls.update,
          type: 'checkbox',
          'class': 'update',
          width: '300px'
        }, {
          name: 'actions',
          title: this.nls.fields,
          type: 'actions',
          'class': 'editable',
          actions: ['edit']
        },
        {
            name: 'fromPortalGroup',
            title: this.nls.fromPortalGroup,
            type: 'checkbox',
            editable: false,
            hidden:true
        }];
        var args = {
          fields: fields,
          selectable: false
        };
        this.displayLayersTable = new Table(args);
        this.displayLayersTable.placeAt(this.tableLayerInfos);
        this.displayLayersTable.startup();

        var fields2 = [{
          name: 'isEditable',
          title: this.nls.edit,
          type: 'checkbox',
          'class': 'editable'
        }, {
          name: 'fieldName',
          title: this.nls.editpageName,
          type: 'text'
        }, {
          name: 'label',
          title: this.nls.editpageAlias,
          type: 'text',
          editable: true
        }, {
          name: 'actions',
          title: this.nls.actions,
          type: 'actions',
          actions: ['up', 'down'],
          'class': 'editable'
        }];
        var args2 = {
          fields: fields2,
          selectable: false
        };
        this.displayFieldsTable = new Table(args2);
        this.displayFieldsTable.placeAt(this.tableFieldInfos);
        this.displayFieldsTable.startup();


        var fields3 = [{
            title: this.nls.paramName,
            name :'paramTitle',
            type: 'text'
           
        }, {
            title: this.nls.urlTag,
            name:'urlTag',
            type: 'text',
            editable:true
        },{
             title: this.nls.paramName,
             name: 'paramName',
             type: 'text',
             hidden:true
        },{
            name: 'actions',
            title: this.nls.editTag,
            type: 'actions',
            'class': 'editable',
           actions: ['edit']
        }];
        var args3 = {
            fields: fields3,
            selectable: false
        };
        this.urlParamsTable = new Table(args3);
        this.urlParamsTable.placeAt(this.urlParamInfos);
        this.urlParamsTable.startup();



        var fields4 = [{
            title: this.nls.presetFieldNameColumn,
            name: 'field',
            type: 'text',
            editable:true

        },{
            name: 'actions',
            title: this.nls.editTag,
            type: 'actions',
            'class': 'editable',
            actions: ['edit','delete']
        }];
        var args4 = {
            fields: fields4,
            selectable: false
        };
        this.presetFieldsTable = new Table(args4);
        this.presetFieldsTable.placeAt(this.presetFieldInfos);
        this.presetFieldsTable.startup();


        var fields5 = [{
            title: this.nls.linkTitle,
            name: 'title',
            type: 'text',
            editable: true

        },{
            title: this.nls.linkHref,
            name: 'href',
            type: 'text',
            editable: true

        }, {
            name: 'actions',
            title: this.nls.editTag,
            type: 'actions',
            'class': 'editable',
            actions: ['edit', 'delete']
        }];
        var args5 = {
            fields: fields5,
            selectable: false
        };
        this.linksTable = new Table(args5);
        this.linksTable.placeAt(this.linkInfos);
        this.linksTable.startup();


        this.own(on(this.displayLayersTable,'actions-edit',lang.hitch(this, this.showLayerFields)));
        this.own(on(this.urlParamsTable, 'actions-edit', lang.hitch(this, function (row) {
            this.onTableEditClick(this.urlParamsTable, row);
        })));
        this.own(on(this.presetFieldsTable, 'actions-edit', lang.hitch(this, function (row) {
            this.onTableEditClick(this.presetFieldsTable, row);
        })));
        on(this.addPresetFields, "click", lang.hitch(this, function () {
            var data = { field:""};
            this.onRowAddClick(this.presetFieldsTable, data);
        }));
        
        this.own(on(this.linksTable, 'actions-edit', lang.hitch(this, function (row) {
            this.onTableEditClick(this.linksTable, row);
        })));

        on(this.addLinks, "click", lang.hitch(this, function () {
            var data = { title: "",href:""};
            this.onRowAddClick(this.linksTable, data);
        }));

        this._initialisePortal().then(lang.hitch(this, function () {
            this.setConfig(this.config);
        }));
      },

      backToFirstPage: function() {
        domStyle.set(this.secondPageDiv, "display", "none");
        domStyle.set(this.firstPageDiv, "display", "");
        this.resetFeaturelayers(this.indexLayer);
        this.indexLayer = -1;
      },

      showLayerFields: function(tr) {
        var tds = query(".action-item-parent", tr);
        if (tds && tds.length) {
          var data = this.displayLayersTable.getRowData(tr);
          if (data.edit) {
            this.displayFieldsTable.clear();
            domStyle.set(this.firstPageDiv, "display", "none");
            domStyle.set(this.secondPageDiv, "display", "");

            var len = this.featurelayers.length;
            for (var i = 0; i < len; i++) {
              if (data.label.toLowerCase() === this.featurelayers[i].label.toLowerCase()) {
                this.indexLayer = i;
                var count = this.featurelayers[i].fields.length;
                for (var m = 0; m < count; m++) {
                  var field = this.featurelayers[i].fields[m];
                  this.displayFieldsTable.addRow({
                    fieldName: field.fieldName,
                    isEditable: field.isEditable,
                    label: field.label
                  });
                }
                break;
              }
            }
          }
        }
      },

      onToolbarSelected: function() {
        if (!this.toolbarVisible.checked) {
          html.setStyle(this.toolbarOptionsTr, 'display', 'none');
        } else {
          html.setStyle(this.toolbarOptionsTr, 'display', 'table-row');
        }
      },

      setConfig: function (config) {
        this.config = config;
        this.displayLayersTable.clear();
        this.featurelayers.length = 0;
        
        this.portalGroupName.set("value", this.config.portalGroupName);
        this.featureIdentifierField.set("value", this.config.featureIdentifierField);
        this.editScaleLimit.set("value", this.config.editScaleLimit);

        var editableLayerFromGroup = false;
        if (!config.editor.layerInfos) {
            config.editor.layerInfos = [];
        }
        array.some(this.config.editor.layerInfos,function(info){
            if(info.fromPortalGroup){
                editableLayerFromGroup = true;
                return false;
            }
        });
        if (this.config.portalGroupName && editableLayerFromGroup) {
            this._deactivateGroupNameInput();
            this._addLayersFromConfig().then(lang.hitch(this,function () {
                this.initSelectLayer();
            }));
        } else {
            this._activateGroupNameInput();
            this.initSelectLayer();
        }

        this._setGeocoderConfigs();
        this._setUrlParamsTable();
        this._setPresetFieldsTable();
        this._setLinks();
      },
      _initialisePortal:function(){
          var deferred = new Deferred();
          this.portal = new arcgisPortal.Portal(this.appConfig.portalUrl);
          this.portal.on("load",function(){
              deferred.resolve();
          },lang.hitch(this,function(){
              this.portal = null;
              deferred.resolve();
          }));
          return deferred.promise;
      },
      _addLayersFromConfig: function () {
          var deferred = new Deferred();
          var portalLayersDeferred = [];
          array.forEach(this.config.editor.layerInfos, lang.hitch(this, function (info) {
              if (info.fromPortalGroup) {
                portalLayersDeferred.push(this._addToMap(info.featureLayer.url, info.featureLayer.title));
              }
          }));
          all(portalLayersDeferred).then(function () {
              deferred.resolve();
          })
          return deferred.promise;
      },
      initSelectLayer: function() {
        var count = 0,
          label = "";
        var len = this.map.graphicsLayerIds.length;
        var has = false;
        var edit = false;

        // editableLayers means has configured and editable checked in setting page.
        var editableLayers = array.map(this.config.editor.layerInfos, function(layerinfo) {
          return layerinfo.featureLayer.url;
        });

          //for (var i = len - 1; i >= 0; i--) {
        for (var i = 0; i < len; i++) {
            var layer = this.map.getLayer(this.map.graphicsLayerIds[i]);
          if (layer.type === "Feature Layer" && layer.url && layer.isEditable()) {
            var fields = [];
            has = true;
            edit = true;
            if (editableLayers.length > 0 && editableLayers.indexOf(layer.url) === -1) {
                edit = false;
                //if this layer is from the portal group,which may be added before settings editor reinstatiation
                if (layer.fromPortalGroup) {
                    this._deactivateGroupNameInput();
                }
            }
            // get fieldsInfo from config
            var allFields = this.getAllFieldsInfo(layer);
            if (!allFields) {
              count = layer.fields.length;
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
            } else {
              fields = allFields;
            }
            label = this.getOperationalLayerTitle(layer);
            label = layer.fromPortalGroup ? label + " (Portal)" : label;
            this.featurelayers.push({
              label: label,
              layer: layer,
              fields: fields,
              edit: edit,
              fromPortalGroup:layer.fromPortalGroup ? true : false
            });
            this.displayLayersTable.addRow({
              label: label,
              edit: edit,
              disableGeometryUpdate: this.getGeometryUpdate(layer),
              fromPortalGroup:layer.fromPortalGroup ? true : false
            });
          }
        }
        if (!has) {
          domStyle.set(this.tableLayerInfosError, "display", "");
          this.tableLayerInfosError.innerHTML = this.nls.noLayers;
        } else {
          domStyle.set(this.tableLayerInfosError, "display", "none");
        }
      },
      
      isLayerInConfig: function(layer) {
        if (this.config.editor.layerInfos) {
          var info = this.config.editor.layerInfos;
          var len = info.length;
          for (var i = 0; i < len; i++) {
            if (info[i].featureLayer && info[i].featureLayer.url) {
              if (info[i].featureLayer.url.toLowerCase() === layer.url.toLowerCase()) {
                return true;
              }
            }
          }
        }
        return false;
      },

      getGeometryUpdate: function(layer) {
        if (this.config.editor.layerInfos) {
          var info = this.config.editor.layerInfos;
          var len = info.length;
          for (var i = 0; i < len; i++) {
            if (info[i].featureLayer && info[i].featureLayer.url) {
              if (info[i].featureLayer.url.toLowerCase() === layer.url.toLowerCase()) {
                return info[i].disableGeometryUpdate;
              }
            }
          }
        }
        return false;
      },

      getAllFieldsInfo: function(layer) {
        if (this.config.editor.layerInfos) {
          var info = this.config.editor.layerInfos;
          var len = info.length;
          for (var i = 0; i < len; i++) {
            if (info[i].featureLayer && info[i].featureLayer.url) {
              if (info[i].featureLayer.url.toLowerCase() === layer.url.toLowerCase()) {
                return info[i].fieldInfos;
              }
            }
          }
        }
        return null;
      },

      getOperationalLayerTitle: function(layer) {
        var title = "";
        if (this.appConfig.map && this.appConfig.map.operationallayers) {
          var len = this.appConfig.map.operationallayers.length;
          for (var i = 0; i < len; i++) {
            if (this.appConfig.map.operationallayers[i].url.toLowerCase() ===
              layer.url.toLowerCase()) {
              title = this.appConfig.map.operationallayers[i].label;
              break;
            }
          }
        }
        if (!title) {
          title = layer.name;
        }
        if (!title) {
          title = layer.url;
        }
        return title;
      },

      resetFeaturelayers: function(index) {
        var fieldInfos = [];
        var data = this.displayFieldsTable.getData();
        if (this.indexLayer > -1 && this.indexLayer === index) {
          var len = data.length;
          for (var i = 0; i < len; i++) {
            var field = {};
            field.fieldName = data[i].fieldName;
            field.label = data[i].label;
            field.isEditable = data[i].isEditable;
            fieldInfos.push(field);
          }
          this.featurelayers[this.indexLayer].fields = fieldInfos;
        } else if (index > -1) {
          fieldInfos = this.featurelayers[index].fields;
        }
        return fieldInfos;
      },
      _setGeocoderConfigs:function(){
          this.geocoderService.set("value", this.config.geocoderService);
         // this.geocoderAddressAttr.set("value", this.config.geocoderAddressAttr);
      },
      _setUrlParamsTable:function(){
          var urlParamInfos = this.config.urlParamInfos || [];
          array.forEach(urlParamInfos, lang.hitch(this, function (info) {
              this.urlParamsTable.addRow(info);
          }));
      },
      _setPresetFieldsTable:function(){
          var presetSourceFields = this.config.presetSourceFields || [];
          array.forEach(presetSourceFields, lang.hitch(this, function (fieldName) {
              this.presetFieldsTable.addRow({
                  'field':fieldName
              });
          }));
      },
      _getPresetFields: function () {
          var presetFieldsConfig = this.presetFieldsTable.getData();
          var filteredData = array.map(array.filter(presetFieldsConfig, function (config) {
              var field = lang.trim(config.field);
              if (field) {
                  return true;
              }
          }),function(item){
              return item.field;
          });
          return filteredData;
      },
      _setLinks: function () {
          var links = this.config.links || [];
          array.forEach(links, lang.hitch(this, function (linkConfig) {
              this.linksTable.addRow({
                  'title': linkConfig.title,
                  'href': linkConfig.href
              });
          }));
      },
      _getLinks: function () {
          var data = this.linksTable.getData();
          var filteredData = array.filter(data, function (data) {
              if (lang.trim(data.title) && lang.trim(data.href)) {
                  return true;
              }
          });
          return filteredData;
      },
      getConfig: function() {
        this.config.editor.enableUndoRedo = this.enableUndoRedo.checked;
        this.config.editor.toolbarVisible = this.toolbarVisible.checked;
        this.config.editor.toolbarOptions.mergeVisible = this.mergeVisible.checked;
        this.config.editor.toolbarOptions.cutVisible = this.cutVisible.checked;
        this.config.editor.toolbarOptions.reshapeVisible = this.reshapeVisible.checked;
        this.config.portalGroupName = this.portalGroupName.get("value");
        this.config.featureIdentifierField = this.featureIdentifierField.get("value");
        this.config.editScaleLimit = this.editScaleLimit.get("value");
        var data = this.displayLayersTable.getData();
        var len = this.featurelayers.length;
        this.config.editor.layerInfos = [];

        for (var i = 0; i < len; i++) {
          if (data[i].edit) {
            var json = {};
            // json.editable = this.featurelayers[i].edit;
            json.featureLayer = {};
            json.featureLayer.url = this.featurelayers[i].layer.url;
            json.featureLayer.title = this.featurelayers[i].layer.title || this.featurelayers[i].layer.name;
            json.disableGeometryUpdate = data[i].disableGeometryUpdate;
            json.fromPortalGroup = data[i].fromPortalGroup;
            json.fieldInfos = [];
            json.fieldInfos = this.resetFeaturelayers(i);
            if (!json.fieldInfos || !json.fieldInfos.length) {
              delete json.fieldInfos;
            }
            this.config.editor.layerInfos.push(json);
          }
        }
        if(this.config.editor.layerInfos.length === 0) {
          this.config.editor.layerInfos = null;
        }
        this.config.geocoderService = this.geocoderService.get("value");
        //this.config.geocoderAddressAttr = this.geocoderAddressAttr.get("value");
        this.config.urlParamInfos = this.urlParamsTable.getData();
        this.config.presetSourceFields = this._getPresetFields();
        this.config.links = this._getLinks();
        return this.config;
      },
      _onSetGroup: function () {
          this._deactivateGroupNameInput();
          this._removeLayersFromPortalGroup();
          this._addLayersFromPortalGroup().then(lang.hitch(this, function () {
              this.removePortalLayersFromDisplayTable();
              this.addPortalItemsToDisplayTable();
          }));
      },
      _onUnsetGroup: function () {
          this._removeLayersFromPortalGroup();
          this.removePortalLayersFromDisplayTable();
          this._activateGroupNameInput();
      },
      _activateGroupNameInput: function () {
          this.portalGroupName.set("disabled", false);
          this.portalGroupName.focus();
          domStyle.set(this.setGroup, "display", "block");
          domStyle.set(this.unsetGroup, "display", "none");
      },
      _deactivateGroupNameInput: function () {
          this.portalGroupName.set("disabled", true);
          this.portalGroupName.set("focused", false);
          domStyle.set(this.setGroup, "display", "none");
          domStyle.set(this.unsetGroup, "display", "block");
      },
      _removeLayersFromPortalGroup:function(){
          array.forEach(this.map.graphicsLayerIds, lang.hitch(this, function (id) {
              if (typeof (this.map.getLayer(id).fromPortalGroup) != 'undefined') {
                  this.map.removeLayer(this.map.getLayer(id));
                  var indexInGraphicIds = array.indexOf(this.map.layerIds, id);
                  if (indexInGraphicIds == -1) {
                      //remove it from graphicLayerIds array
                      this.map.graphicsLayerIds.splice(indexInGraphicIds)
                  }
              }
          }));
          array.forEach(this.featurelayers, lang.hitch(this, function (obj, index) {
              if (obj && obj.fromPortalGroup) {
                  this.featurelayers.splice(index, 1);
              }
          }));
      },
      _addLayersFromPortalGroup: function () {
          var deferred = new Deferred();
          var params = {
              q: 'title: ' + this.portalGroupName.get("value")
          };
          this.portal.queryGroups(params).then(lang.hitch(this, function (groups) {
              var grp = groups.results[0];
              if (grp) {
                  var params = {
                      q: 'type:"Feature Service"'
                  };
                  grp.queryItems(params).then(lang.hitch(this, function (resp) {
                      var featureLayerDeferrds = [];
                      array.forEach(resp.results, lang.hitch(this, function (layerInfo) {
                          featureLayerDeferrds.push(this._addFeatureLayer(layerInfo));
                      }));
                      all(featureLayerDeferrds).then(function () {
                          deferred.resolve();
                      })
                  }));
              } else {
                  deferred.resolve();
              }

          }));
          return deferred.promise;
      },

      _addFeatureLayer: function (item) {
          var deferred = new Deferred();
          var layerUrl = item.url;
          var layerId = layerUrl.substr(layerUrl.lastIndexOf('/') + 1);
          var deferred = new Deferred();
          var regExp = /\d+/g;
          if (regExp.test(layerId)) {
              this._addToMap(layerUrl,item.title).then(function () {
                  deferred.resolve();
              });
          } else {
              this._requestServerResourceInfo(item).then(lang.hitch(this, function (info) {
                  if (info.layers && info.layers.length > 0) {
                      var featureLayersAddDeferred = [];
                      array.forEach(info.layers, lang.hitch(this, function (layerObj) {
                          var url = layerUrl + "/" + layerObj.id;
                          featureLayersAddDeferred.push(this._addToMap(url, layerObj.name));
                      }));
                      all(featureLayersAddDeferred).then(function () {
                          deferred.resolve();
                      });
                  } else {
                      deferred.resolve();
                  }
              }));
          }
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
              deferred.resolve(info)
          }, function (err) {
              deferred.reject(err);
          });
          return deferred.promise;
      },
      _addToMap: function (url,title) {
          var deferred = new Deferred();
          //check if layer exists ..if it exists dont add...otherwise add it
          var layerInMap = array.filter(this.map.graphicsLayerIds, lang.hitch(this, function (id) {
              return this.map.getLayer(id).url === url;
          }))[0];
          if (!layerInMap) {
              //layer.id = item.id;
              //layer.portalId = item.id;
              var layer = new FeatureLayer(url, {
                  outFields: ['*'],
                  visible:true
              });
              layer.title = title;
              layer.fromPortalGroup = true;
              layer.id = new Date().getTime().toString();
              this.map.addLayers([layer]);

              var indexInLayerIds = array.indexOf(this.map.layerIds, layer.id);
              if (indexInLayerIds > 0) {
                  this.map.layerIds.splice(indexInLayerIds, 1);
              }
              var indexInGraphicIds = array.indexOf(this.map.layerIds, layer.id);
              if (indexInGraphicIds == -1) {
                  //add it in graphicLayerIds array
                  this.map.graphicsLayerIds.push(layer.id)
              }
              window.setTimeout(lang.hitch(this, function () {
                  this._checkForLoad(layer).then(lang.hitch(this,function () {
                      deferred.resolve();
                  }))
              }),1000);
              
          } else {
              deferred.resolve();

          }
          return deferred.promise;
      },
      _checkForLoad: function (layer) {
          var deferred = new Deferred();
          if (layer.loaded) {
              deferred.resolve();
          } else {
              layer.on('load', function () {
                  deferred.resolve();
              });
              layer.on('error', function (err) {
                  deferred.reject(err);
              });
          }
          return deferred.promise;
      },
      addPortalItemsToDisplayTable: function () {
          var count = 0,
            label = "";
          var portalLayerIds = array.filter(this.map.graphicsLayerIds, lang.hitch(this, function (id) {
              return this.map.getLayer(id).fromPortalGroup
          }));
          var has = false;
          var edit = false;

          // editableLayers means has configured and editable checked in setting page.
          var editableLayers = array.map(this.config.editor.layerInfos, function (layerinfo) {
              return layerinfo.featureLayer.url;
          });

          array.forEach(portalLayerIds,lang.hitch(this,function(id){
              var layer = this.map.getLayer(id);
              if (layer.type === "Feature Layer" && layer.url && layer.isEditable()) {
                  var fields = [];
                  has = true;
                  edit = true;
                  if (editableLayers.length > 0 && editableLayers.indexOf(layer.url) === -1) {
                      edit = false;
                  }
                  // get fieldsInfo from config
                  var allFields = this.getAllFieldsInfo(layer);
                  if (!allFields) {
                      count = layer.fields.length;
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
                  } else {
                      fields = allFields;
                  }
                  label = this.getOperationalLayerTitle(layer);
                  this.featurelayers.push({
                      label: label,
                      layer: layer,
                      fields: fields,
                      edit: edit,
                      fromPortalGroup: true
                  });
                  this.displayLayersTable.addRow({
                      label: label +" (Portal)",
                      edit: edit,
                      disableGeometryUpdate: this.getGeometryUpdate(layer),
                      fromPortalGroup: true
                  });
              }
          }))
          //if (!has) {
          //    domStyle.set(this.tableLayerInfosError, "display", "");
          //    this.tableLayerInfosError.innerHTML = this.nls.noLayers;
          //} else {
          //    domStyle.set(this.tableLayerInfosError, "display", "none");
          //}
      },
      removePortalLayersFromDisplayTable: function () {
          var rows = this.displayLayersTable.getRows();
          array.forEach(rows, lang.hitch(this, function (row) {
              var rowData = this.displayLayersTable.getRowData(row);
              if (rowData.fromPortalGroup) {
                  this.displayLayersTable.deleteRow(row);
              }
          }));
      },
      onTableEditClick: function (table, row) {
          table.finishEditing();
          var data = table.getRowData(row);
          table.editRow(row, data);
      },
      onRowAddClick: function (table, data) {
          table.finishEditing();
          var rowAddResult = table.addRow(data, false);
          var row = rowAddResult.tr;
          table.editRow(row, data);
      }
    });
  });