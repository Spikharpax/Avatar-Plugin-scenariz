const {ipcRenderer, remote} = require('electron');
const {dialog, BrowserWindow} = remote;
const cytoscape = require('cytoscape');
const {Graph} = require('cyto-avatar');
const _ = require('underscore');
const klawSync = require('klaw-sync');
const fs = require('fs-extra');
const moment = require('moment');
moment.locale('fr');

let initTest;

let nodesize = 45;
let nodespace = 30;

let CY = cytoscape({
  container: document.getElementById('CY'),
  boxSelectionEnabled: false,
  autounselectify: false,
  zoomingEnabled: false,
  autoungrabify : false,
  selectionType: 'single',
  userZoomingEnabled: false,
  userPanningEnabled: false,
  panningEnabled: false,
  zoom: 1,
  pan: { x: 0, y: 0 },
  pixelRatio: 'auto',
  style: cytoscape.stylesheet()
      .selector('node')
      .css({
        'background-fit': 'cover',
        'border-color': "rgba(226, 45, 17, 1)",
        'border-width': 3,
        'border-opacity': 0,
        "font-size" : "12px",
        "color" : "white",
        "text-wrap": "wrap",
        "text-valign": "bottom",
        "text-halign": "center",
        'text-outline-width': 3,
        'text-outline-color': "rgba(86, 87, 85, 1)"
      })
});


let WFCY = cytoscape({
  container: document.getElementById('WFCY'),
  boxSelectionEnabled: false,
  autounselectify: false,
  zoomingEnabled: false,
  autoungrabify : false,
  selectionType: 'single',
  userZoomingEnabled: false,
  userPanningEnabled: false,
  panningEnabled: false,
  zoom: 1,
  pan: { x: 0, y: 0 },
  pixelRatio: 'auto',
  style: cytoscape.stylesheet()
      .selector('node')
      .css({
        'background-fit': 'cover',
        'border-color': "rgba(226, 45, 17, 1)",
        'border-width': 3,
        'border-opacity': 0,
        "font-size" : "12px",
        "color" : "black",
        "text-wrap": "wrap",
        "text-max-width": "100px",
        "text-valign": "bottom",
        "text-halign": "center",
        'text-outline-width': 0,
        'text-outline-color': "rgba(86, 87, 85, 1)"
      })
      .selector('edge')
      .css({
        'curve-style': 'bezier',
        'width': 2,
        'target-arrow-shape': 'triangle',
        'line-color': "red",
        'target-arrow-color': "red"
      })
});

let cyto = new Graph (CY);
let wfCyto = new Graph (WFCY);
let WFselected;
let WFActionSelected;
let Clients = ["Pièce courante"];
let Plugins = [];

window.onbeforeunload = (e) => {
  e.preventDefault();
  close();
}


function close() {
  let state = ipcRenderer.sendSync('Scenariz', 'quit');
}


/*document.getElementById('exit').addEventListener('click', function(){
    close();
});*/

document.getElementById('WFCY').addEventListener('click', function(){
  selectWFAction ();
});


document.getElementById('testKey').addEventListener('click', function() {

  if (!WFActionSelected) return;

  let child;
  let menuPlugin = document.getElementById('menu-plugin');
  for(var i=0; i < menuPlugin.childNodes.length;i++) {
      child = menuPlugin.childNodes[i];
      if (child.toggled) {
        break;
      }
  }
  if (child.value == 'Sélectionnez un plugin') {
    notification("Sélectionnez un plugin pour tester la tâche !");
    return;
  }
  let plugin = child.value;

  let menuClient = document.getElementById('menu-client');
  for(var i=0; i < menuClient.childNodes.length;i++) {
      child = menuClient.childNodes[i];
      if (child.toggled) {
        break;
      }
  }
  if (child.value == 'Sélectionnez un client') {
    notification ("Sélectionnez un client pour tester la tâche !");
    return false;
  }
  if (child.value == 'Pièce courante') {
    notification ("Impossible de tester la pièce courante.<br>Sélectionnez un client connecté.");
    return false;
  }
  let client = child.value;
  let keys = document.getElementById("key").value;
  if (keys && keys.length > 0 && keys.indexOf("~client=") != -1 && keys.indexOf("~client="+client) == -1) {
      keys = keys.substring(0,keys.indexOf("~client=")+8) + client;
  } else if (keys && keys.length > 0 && keys.indexOf("~client=") == -1) {
      keys = keys+"~client="+client;
  } else if (!keys || (keys && keys.length == 0 )) {
      keys = "client="+client;
  }

  if (!initTest) {
    initTest = ipcRenderer.sendSync('initTest', client);
  }

  let infos = {plugin: plugin, client: client, keys: keys, speech: document.getElementById("speech").value}
  let value = ipcRenderer.sendSync('testTask', infos);
  switch(value) {
    case 0:
      notification ("Choisissez un autre client !");
      break;
    case 1:
      notification ("La tâche a été exécutée.<br>Si vous constatez un comportement non attendu,<br>consultez la console Avatar pour plus de détails.");
      break;
    case 2:
      notification ("La tâche a générée une erreur.<br>Consultez la console Avatar pour plus de détails.");
      break;
  }
});


document.getElementById('addprogram').addEventListener('click', function(){
  resetGraph ();
  document.getElementById("createscenariz").style.display = "block";
  wfCyto.removeGraphElementsByClass("WFscenario");
});


document.getElementById('addaction').addEventListener('click', function(){
  document.getElementById("createtask").style.display = "block";
  resetWFparams(true, false, true);
});

document.getElementById('addnewaction').addEventListener('click', function(){
  document.getElementById("createnewtask").style.display = "block";
  resetWFparams(true, true);
});


document.getElementById('deleteprogram').addEventListener('click', function(){

  if (!WFselected) {
    notification("Sélectionnez un scénario pour le supprimer")
    return;
  }

  let ID = ipcRenderer.sendSync('Scenariz', 'getID');
  let win = BrowserWindow.fromId(ID);
  let options = {
    type: "question",
    title: "Supprimer le scénario",
    buttons: ["Oui", "Non"],
    message: 'Voulez-vous vraiment supprimer le scénario "'+WFselected.data('name')+'" ?',
    detail: 'Toutes les tâches seront supprimées'
  };
  dialog.showMessageBox(win, options, function (response) {
    if (response == 1) return;

    wfCyto.getGraphElementsByClass("WFscenario")
    .then(collection => {
      return new Promise((resolve, reject) => {
          let state;
          let count = collection.length;
          if (count && count > 0) {
              _.each(collection, (elem) => {
                  if (!state) {
                    let status = ipcRenderer.sendSync('deleteTask', {program: elem.data('program'), name: elem.data('name')});
                    if (status == false) {
                      state = true;
                    }
                    if (!--count) {
                      if (state)
                        reject();
                      else
                        resolve();
                    }
                  }
              });
          } else {
              resolve();
          }
      })
    })
    .then(() => wfCyto.removeGraphElementsByClass("WFscenario"))
    .then(() => {
      return new Promise((resolve, reject) => {
        getScenario (true);
        resetGraph();
        resolve();
      })
    })
    .then(() => {
        notification ("Le scénario a été correctement supprimé");
    })
    .catch(err => {
      notification ("Erreur: Impossible de supprimer le scénario");
    })

  })

})


document.getElementById('modifyaction').addEventListener('click', function(){
  if (!WFActionSelected) return;

  checkWFParams(true, null, state => {
    if (!state) return;

    wfCyto.getGraphElementByName(WFActionSelected.data('name'))
    .then(elem => {
        return new Promise((resolve, reject) => {
          let client = document.getElementById("client").value;
          client = client == 'Pièce courante' ? 'currentRoom' : client;
          elem.data("client", client);
          elem.data("tempo", ((document.getElementById("temporisation").value && document.getElementById("temporisation").value != "") ? document.getElementById("temporisation").value : "1000"));
          elem.data("plugin", document.getElementById("plugin").value);
          elem.data("speech", document.getElementById("speech").value);
          elem.data("keys", document.getElementById("key").value);

          let params = {
            program: elem.data('program'),
            name: elem.data('name'),
            order: elem.data('order'),
            client: elem.data('client'),
            plugin: elem.data('plugin'),
            tempo: elem.data('tempo'),
            exec: elem.data('exec'),
            keys: elem.data('keys'),
            speech: elem.data('speech'),
            hour: elem.data('hour'),
            days: elem.data('days')
          }

          let keys = params.keys;
          if (keys && keys.length > 0 && keys.indexOf("~client=") != -1 && keys.indexOf("~client="+params.client) == -1) {
              params.keys = keys.substring(0,keys.indexOf("~client=")+8) + params.client;
          } else if (keys && keys.length > 0 && keys.indexOf("~client=") == -1) {
              params.keys = keys+"~client="+params.client;
          } else if (!keys || (keys && keys.length == 0 )) {
              params.keys = "client="+params.client;
          }

          let status = ipcRenderer.sendSync('createTask', params);
          if (status == false)
            reject();
          else
            resolve();
      });
    })
    .then(() => {
        notification ("La tâche a été correctement modifiée");
    })
    .catch(err => {
      notification ("Erreur: Impossible de modifier la tâche");
    })
  })
})


document.getElementById('removeaction').addEventListener('click', function(){
  if (!WFActionSelected) return;

  let ID = ipcRenderer.sendSync('Scenariz', 'getID');
  let win = BrowserWindow.fromId(ID);
  let options = {
    type: "question",
    title: "Supprimer la tache",
    buttons: ["Oui", "Non"],
    message: 'Voulez-vous vraiment supprimer la tâche "'+WFActionSelected.data('name')+'" ?',
  };
  dialog.showMessageBox(win, options, function (response) {
    if (response == 1) return;

    let previousTask;
    let nextTask;
    let order = parseInt(WFActionSelected.data('order'));
    let hour = WFActionSelected.data('hour');
    let program = WFActionSelected.data('program');
    let name = WFActionSelected.data('name');
    let collectionUpdate = WFCY.collection();

    wfCyto.getGraphElementsByClass("WFscenario")
    .then(collection => {
      return new Promise((resolve, reject) => {
          _.each(collection, (num) => {
            if (num.data('hour') == hour && parseInt(num.data('order')) == order -1)
              previousTask = num;
            else if (num.data('hour') == hour && parseInt(num.data('order')) == order +1)
              nextTask = num;
          });

          resolve();
      })
    })
    .then(() => wfCyto.removeGraphElementByID(WFActionSelected.id()))
    .then(() => {
        return new Promise((resolve, reject) => {
          if (previousTask && nextTask) {
              let id = random(1, 100000).toString();
              WFCY.add({ group: "edges",
                   data: { id: id,
                           source: previousTask.id(),
                           target: nextTask.id(),
                          strength : 90
                        }
              })
              WFCY.$('#'+id).addClass("WFEdgeAction");
          }
          resolve();
        })
    })
    .then(() => {
      return new Promise((resolve, reject) => {
        let status = ipcRenderer.sendSync('deleteTask', {program: program, name: name});
        if (status == true)
          resolve();
        else
          reject();
      })
    })
    .then(() => wfCyto.getGraphElementsByClass("WFscenario"))
    .then(collection => {
        return new Promise((resolve, reject) => {
          _.each(collection, (num) => {
            if (num.data('hour') == hour && parseInt(num.data('order')) > order) {
              collectionUpdate = collectionUpdate.union(num);
            }
          });
          resolve();
        })
    })
    .then(() => {
      return new Promise((resolve, reject) => {
          let state;
          let count = collectionUpdate.length;

          if (count && count > 0) {
              _.each(collectionUpdate, (elem) => {
                  elem.data('order', (parseInt(elem.data('order')) - 1).toString());
                  if (!state) {
                    let params = {
                      program: elem.data('program'),
                      name: elem.data('name'),
                      order: elem.data('order'),
                      client: elem.data('client'),
                      plugin: elem.data('plugin'),
                      tempo: elem.data('tempo'),
                      exec: elem.data('exec'),
                      keys: elem.data('keys'),
                      speech: elem.data('speech'),
                      hour: elem.data('hour'),
                      days: elem.data('days')
                    }

                    let keys = params.keys;
                    if (keys && keys.length > 0 && keys.indexOf("~client=") != -1 && keys.indexOf("~client="+params.client) == -1) {
                        params.keys = keys.substring(0,keys.indexOf("~client=")+8) + params.client;
                    } else if (keys && keys.length > 0 && keys.indexOf("~client=") == -1) {
                        params.keys = keys+"~client="+params.client;
                    } else if (!keys || (keys && keys.length == 0 )) {
                        params.keys = "client="+params.client;
                    }

                    let status = ipcRenderer.sendSync('createTask', params);
                    if (status == false) {
                      state = true;
                    }
                    if (!--count) {
                      if (state)
                        reject();
                      else
                        resolve();
                    }
                  }
              });
          } else {
              resolve();
          }
      })
    })
    .then(() => wfCyto.getGraphElementsByClass("WFscenario"))
    .then(collection => {
      return new Promise((resolve, reject) => {
          if (collection.length > 0) {
            resetGraph(WFselected, true);
            resolve(false);
          } else {
              getScenario (true);
              resetGraph(null, true);
              resolve(true);
          }
      })
    })
    .then(state => {
      if (nextTask)
        notification ("La tâche a été correctement supprimée et l'ordre des tâches suivantes a été mis à jour");
      else {
        if (state)
          notification ("Le scénario a été correctement supprimé");
        else
          notification ("La tâche a été correctement supprimée");
      }
    })
    .catch(err => {
      notification ("Erreur: Impossible de supprimer la tâche");
    })
  })

});


document.getElementById("createscenario").addEventListener('click', function () {

  checkWFParams(null, null, state => {
      if (!state) return;

      addWFNode("1", 70, 50, null, (elem) => {
        if (elem) {
          let params = {
            program: elem.data('program'),
            name: elem.data('name'),
            order: elem.data('order'),
            client: elem.data('client'),
            plugin: elem.data('plugin'),
            tempo: elem.data('tempo'),
            exec: elem.data('exec'),
            keys: elem.data('keys'),
            speech: elem.data('speech'),
            hour: elem.data('hour'),
            days: elem.data('days')
          }

          let keys = params.keys;
          if (keys && keys.length > 0 && keys.indexOf("~client=") != -1 && keys.indexOf("~client="+params.client) == -1) {
              params.keys = keys.substring(0,keys.indexOf("~client=")+8) + params.client;
          } else if (keys && keys.length > 0 && keys.indexOf("~client=") == -1) {
              params.keys = keys+"~client="+params.client;
          } else if (!keys || (keys && keys.length == 0 )) {
              params.keys = "client="+params.client;
          }

          let status = ipcRenderer.sendSync('createTask', params);
          if (status == true) {
            getScenario (true, elem.data('program'), scenario => {
              scenario.select();
              WFselected = scenario;
              scenario.style ({
                'border-opacity': 1
              });
              selectWFAction (elem);
              setWFparams (elem);
              setModifyParams(true, null, true);
              setDisplayActionButtons(true);
              notification ("Le scénario a été correctement crée");
            })
          } else {
            notification ("Erreur: Impossible de sauvegarder la tâche");
          }
        } else {
          notification ("Erreur: Impossible de créer le node de la tâche");
        }

      })
    })
})


document.getElementById("createnew").addEventListener('click', function () {

  checkWFParams(null, true, state => {
      if (!state) return;

      wfCyto.getGraphElementsByClass("WFscenario")
      .then(collection => {
            let Y = 50;
            _.each(collection, (num) => {
              if (num.data('order') == "1" && num.position('y') > Y) {
                  Y = num.position('y');
              }
            });

            resizeY_WFCY(Y, true);
            let X = 70;
            Y += (nodespace * 2) + nodesize;

            addWFNode("1", X, Y, null, (elem) => {
              if (elem) {
                let params = {
                  program: elem.data('program'),
                  name: elem.data('name'),
                  order: elem.data('order'),
                  client: elem.data('client'),
                  plugin: elem.data('plugin'),
                  tempo: elem.data('tempo'),
                  exec: elem.data('exec'),
                  keys: elem.data('keys'),
                  speech: elem.data('speech'),
                  hour: elem.data('hour'),
                  days: elem.data('days')
                }

                let keys = params.keys;
                if (keys && keys.length > 0 && keys.indexOf("~client=") != -1 && keys.indexOf("~client="+params.client) == -1) {
                    params.keys = keys.substring(0,keys.indexOf("~client=")+8) + params.client;
                } else if (keys && keys.length > 0 && keys.indexOf("~client=") == -1) {
                    params.keys = keys+"~client="+params.client;
                } else if (!keys || (keys && keys.length == 0 )) {
                    params.keys = "client="+params.client;
                }

                let status = ipcRenderer.sendSync('createTask', params);
                if (status == true) {
                  notification ("La tâche a été correctement créée !");
                  selectWFAction (elem);
                  setWFparams (elem);
                  setModifyParams(true, null, true);
                  setDisplayActionButtons(true);
                } else {
                  notification ("Erreur: Impossible de sauvegarder la tâche");
                }
              } else {
                notification ("Erreur: Impossible de créer le node de la tâche");
              }
          })
      })
  })
})


function resizeX_WFCY (X, create) {
  let width = parseInt(document.getElementById('WFCY').style.width.replace('px',''));
  if (width <= X + nodesize + (nodesize / 2) + (nodespace * 2)) {
    if (!create)
      document.getElementById('WFCY').style.width = Math.round(X) + (nodespace * 2 ) + "px";
    else
      document.getElementById('WFCY').style.width = Math.round(X) + (nodespace * 2 ) + (nodesize * 2) + nodespace + "px";
  }
}



function resizeY_WFCY (Y, create) {
  let height = parseInt(document.getElementById('WFCY').style.height.replace('px',''));
  if (height <= (Y + 100)) {
    if (!create)
      document.getElementById('WFCY').style.height = Math.round(Y) + 75 + "px";
    else
      document.getElementById('WFCY').style.height = Math.round(Y) + (nodespace * 2) + (nodesize * 2) + nodespace + "px";
  }
}


document.getElementById("create").addEventListener('click', function () {

    if (!WFActionSelected) return;

    checkWFParams(null, null, state => {
        if (!state) return;

        wfCyto.getGraphElementsByClass("WFscenario")
        .then(collection => {
              let counter = 0;
              let lastWFaction;
              let hour = WFActionSelected.data('hour');
              _.each(collection, (num) => {
                if (num.data('hour') == hour && parseInt(num.data('order')) > counter) {
                  lastWFaction = num;
                  counter = parseInt(num.data('order'));
                }
              });

              if (!lastWFaction) {
                notification ("Impossible de retrouver la dernière tâche du programme");
                return;
              }

              resizeX_WFCY (lastWFaction.position('x'), true);
              let X = lastWFaction.position('x') + 120;
              let Y = lastWFaction.position('y');
              addWFNode(++counter, X, Y, lastWFaction.id(), (elem) => {
                if (elem) {
                  let params = {
                    program: elem.data('program'),
                    name: elem.data('name'),
                    order: elem.data('order'),
                    client: elem.data('client'),
                    plugin: elem.data('plugin'),
                    tempo: elem.data('tempo'),
                    exec: elem.data('exec'),
                    keys: elem.data('keys'),
                    speech: elem.data('speech'),
                    hour: elem.data('hour'),
                    days: elem.data('days')
                  }

                  let keys = params.keys;
                  if (keys && keys.length > 0 && keys.indexOf("~client=") != -1 && keys.indexOf("~client="+params.client) == -1) {
                      params.keys = keys.substring(0,keys.indexOf("~client=")+8) + params.client;
                  } else if (keys && keys.length > 0 && keys.indexOf("~client=") == -1) {
                      params.keys = keys+"~client="+params.client;
                  } else if (!keys || (keys && keys.length == 0 )) {
                      params.keys = "client="+params.client;
                  }

                  let status = ipcRenderer.sendSync('createTask', params);
                  if (status == true) {
                    notification ("La tâche a été correctement créée !", "1500");
                    selectWFAction (elem);
                    setWFparams (elem);
                    setModifyParams(true, null, true);
                    setDisplayActionButtons(true);
                  } else {
                    notification ("Erreur: Impossible de sauvegarder la tâche");
                  }
                } else {
                  notification ("Erreur: Impossible de créer le node de la tâche");
                }
            })
        })
    })
});




function notification (txt, timeout) {
  let notification = document.getElementById('notification');
  notification.innerHTML = txt;
  notification.opened = true;
  if (timeout)
    notification.timeout = timeout;
}


function addScenarios (scenarios, name, next) {

  for (count in scenarios) {
    addNode(cyto, scenarios[count], count)
    .then(elem => {
      return new Promise((resolve, reject) => {
        if (name && elem.data('name') == name) next(elem);
        resolve(elem);
      })
    })
    .then(elem => cyto.onClick(elem, (evt) => {
      showWorkFlow(elem);
    }))
    .catch(err => {
      console.log('err:', err || 'erreur à la création du node scenario');
      return;
    })
  };
}


function selectWFAction (elem) {

  if (elem) {
    if (WFActionSelected) {
      WFActionSelected.unselect();
      WFActionSelected.style ({
        'border-opacity': 0
      });
    }
    elem.select();
    WFActionSelected = elem;
    elem.style ({
      'border-opacity': 1
    });
  }
}


function setDisplayActionButtons (display) {

  if (display) {
    document.getElementById("addaction").style.display = "inline-block";
    document.getElementById("removeaction").style.display = "inline-block";
    document.getElementById("addnewaction").style.display = "inline-block";
    document.getElementById("modifyaction").style.display = "inline-block";
  } else {
    document.getElementById("addaction").style.display = "none";
    document.getElementById("removeaction").style.display = "none";
    document.getElementById("addnewaction").style.display = "none";
    document.getElementById("modifyaction").style.display = "none";
    document.getElementById("createscenariz").style.display = "none";
  }
  document.getElementById("createtask").style.display = "none";
  document.getElementById("createnewtask").style.display = "none";

}


function resetGraph (elem, action) {

  WFActionSelected = null;
  resetWFparams(false);
  setDisplayActionButtons(false);

  if (elem) {
    if (WFselected) {
      WFselected.unselect();
      WFselected.style ({
        'border-opacity': 0
      });
    }
    elem.select();
    WFselected = elem;
    elem.style ({
      'border-opacity': 1
    });
  } else if (WFselected) {
      WFselected.unselect();
      WFselected.style ({
        'border-opacity': 0
      });
      WFselected = null;
  }

  if (!action) {
    document.getElementById('WFCY').style.width = "850px";
    document.getElementById('WFCY').style.height = "305px";
  }
}


function showWorkFlow(elem) {

  wfCyto.removeGraphElementsByClass("WFscenario");
  resetGraph(elem);

  let scenario = ipcRenderer.sendSync('getScenario', elem.data('name'));
  let sorted = _.groupBy(scenario, num => { return num.Hour;})
  let tasks = [];
  _.each(sorted, num => {
    tasks.push(_.sortBy(num, item => {
      return parseInt(item.Order);
    }))
  })

  setWFScenario(tasks, 0, 70, 50);

}


function setWFScenario (sorted, count, X, Y) {
  if (count >= sorted.length)
    return;

  setWFNode(sorted[count], 0, X, Y, null, () => {
    resizeY_WFCY(Y);
    setWFScenario(sorted, ++count, X, (Y + 100));
  })
}


function random(min, max) {
 return Math.floor(Math.random() * (max - min + 1)) + min;
}



function addWFNode(order, X, Y, WFparent, callback) {

    wfCyto.addGraphElement(WFCY, null, null, true)
    .then(elem => wfCyto.addElementName(elem, document.getElementById("task").value))
    .then(elem => wfCyto.addElementData(elem, 'program', document.getElementById("scenario").value))
    .then(elem => wfCyto.addElementData(elem, 'order', order))
    .then(elem => {
        return new Promise((resolve, reject) => {
          let client = document.getElementById("client").value;
          client = client == 'Pièce courante' ? 'currentRoom' : client;
          wfCyto.addElementData(elem, 'client', client)
          .then(elem => {
            resolve(elem);
          })
          .catch(err => {
            reject(err);
          })
        })
    })
    .then(elem => wfCyto.addElementData(elem, 'plugin', document.getElementById("plugin").value))
    .then(elem => wfCyto.addElementData(elem, 'tempo', ((document.getElementById("temporisation").value && document.getElementById("temporisation").value != "") ? document.getElementById("temporisation").value : "1000")))
    .then(elem => wfCyto.addElementData(elem, 'exec', (document.getElementById("cron").toggled ? "true" : "false")))
    .then(elem => wfCyto.addElementData(elem, 'keys', document.getElementById("key").value))
    .then(elem => wfCyto.addElementData(elem, 'speech', document.getElementById("speech").value))
    .then(elem => wfCyto.addElementData(elem, 'hour', document.getElementById("hour").value))
    .then(elem => wfCyto.addElementData(elem, 'days', ((document.getElementById("day").value && document.getElementById("day").value != "") ? document.getElementById("day").value : "1111111")))
    .then(elem => wfCyto.addElementLabelOnly(elem, document.getElementById("task").value))
    .then(elem => wfCyto.addElementClass(elem, "WFscenario"))
    .then(elem => wfCyto.addElementImage(elem, __dirname+"/../images/task.png"))
    .then(elem => wfCyto.addElementSize(elem, {width: 45, height: 45}))
    .then(elem => wfCyto.addElementPosition(elem, { x:X, y:Y }))
    .then(elem => {
      return new Promise((resolve, reject) => {
        if (WFparent) {
          let id = random(1, 100000).toString();
            WFCY.add({ group: "edges",
                 data: { id: id,
                         source: WFparent,
                         target: elem.id(),
                        strength : 90
                      }
            })
            WFCY.$('#'+id).addClass("WFEdgeAction");
        }
        WFparent = elem.id();
        resolve(elem);
      })
    })
    .then(elem => {
      wfCyto.onClick(elem, (evt) => {
          selectWFAction (elem);
          setWFparams (elem);
          setModifyParams(true, null, true);
          setDisplayActionButtons(true);
      });
      callback(elem);
    })
    .catch(err => {
      console.log('err:', err || 'erreur à la création de la tâche');
      callback();
    })
}


function checkWFParams (modif, newtask, callback) {

  if (document.getElementById("scenario").value == "") {
    notification ("Le nom du scénario est manquant !");
    return callback (false);
  }
  cyto.getGraphElementsByClass('scenario')
  .then(scenarios => {
      let status;
      if (!document.getElementById("scenario").disabled) {
        _.each(scenarios, scenario => {
            if (!status && scenario.data('name').toLowerCase() == document.getElementById("scenario").value.toLowerCase())
              status = true;
        })
      }
      if (status) {
        notification ("Ce nom de scénario est déjà utilisé, choisissez-en un autre !");
        return callback (false);
      }

      if (document.getElementById("task").value == "") {
        notification ("Le nom de la tâche est manquant !");
        return callback (false);
      }

      status = false;
      let count = 0;
      wfCyto.getGraphElementsByClass("WFscenario")
      .then(collection => {
          _.each(collection, (num) => {
            if (!status && modif && num.data('name').toLowerCase() == document.getElementById("task").value.toLowerCase()) {
              count += 1;
              if (count > 1) {
                notification ("Ce nom de tâche est déjà utilisé dans le scénario, choisissez-en un autre !");
                status = true;
              }
            } else if (!status && !modif && num.data('name').toLowerCase() == document.getElementById("task").value.toLowerCase()) {
              notification ("Ce nom de tâche est déjà utilisé dans le scénario, choisissez-en un autre !");
              status = true;
            }
          });

          if (status)
            return callback (false);

          let child;
          let menuClient = document.getElementById('menu-client');
          for(var i=0; i < menuClient.childNodes.length;i++) {
              child = menuClient.childNodes[i];
              if (child.toggled) {
                break;
              }
          }
          if (child.value == 'Sélectionnez un client') {
            notification ("Choisissez un client pour exécuter la tâche !");
            return callback (false);
          }

          let menuPlugin = document.getElementById('menu-plugin');
          for(var i=0; i < menuPlugin.childNodes.length;i++) {
              child = menuPlugin.childNodes[i];
              if (child.toggled) {
                break;
              }
          }
          if (child.value == 'Sélectionnez un plugin') {
            notification ("Choisissez un plugin pour exécuter la tâche !");
            return callback (false);
          }

          if (document.getElementById("hour").value == "") {
            notification ("L'heure d'exécution de la tâche est manquante !");
            return callback (false);
          }
          if(moment(document.getElementById("hour").value, 'HH:mm').inspect().indexOf('moment.invalid') != -1) {
            notification ("L'heure de démarrage de la tâche est invalide !<br>Le format doit être HH:mm");
            return callback (false);
          }

          status = false;
          count = 0;
          wfCyto.getGraphElementsByClass("WFscenario")
          .then(collection => {
              _.each(collection, (num) => {
                if (!status && newtask && num.data('hour') == document.getElementById("hour").value) {
                  notification ("Cette heure est déjà utilisée, choisissez-en une autre ou ajoutez une nouvelle tâche dans l'arbre associé à cette heure !");
                  status = true;
                }
              });

              if (status)
                return callback (false);

              if (document.getElementById("day").value != "") {
                if (document.getElementById("day").value.length != 7) {
                  notification ("Le format des jours d'exécution de la tâche n'est pas bon !");
                  return callback (false);
                }
                for (let i=0; i < document.getElementById("day").value.length; i++) {
                  if (document.getElementById("day").value[i] != "0" && document.getElementById("day").value[i] != "1") {
                    notification ("Le format des jours d'exécution de la tâche n'est pas bon !");
                    return callback (false);
                  }
                }
              }

              if (!document.getElementById("cron").toggled && !document.getElementById("appel").toggled) {
                notification ("Choisissez si la tâche est exécutée par Cron ou par règle vocale !");
                return callback (false);
              }

              if (document.getElementById("temporisation").value != "") {
                if (document.getElementById("temporisation").value.indexOf('.') != -1) {
                  notification ("Entrez une valeur de temporisation en milli-secondes !");
                  return callback (false);
                }
                if (parseInt(document.getElementById("temporisation").value).toString() != document.getElementById("temporisation").value) {
                  notification ("Entrez une valeur de temporisation en milli-secondes !");
                  return callback (false);
                }
                if (!Number.isInteger(parseInt(document.getElementById("temporisation").value))) {
                  notification ("Entrez une valeur de temporisation en milli-secondes !");
                  return callback (false);
                }
              }
              return callback (true);
          })
      })
      .catch(err => {
        console.log('Erreur checkWFParams:', err)
        notification ("Erreur dans la vérification des paramètres de la tâche" + err);
        return callback (false);
      })
  })
}





function setWFparams (elem) {

  document.getElementById("scenario").value = elem.data("program");
  document.getElementById("task").value = elem.data("name");

  let menuClient = document.getElementById('menu-client');
  for(var i=0; i < menuClient.childNodes.length;i++) {
      let child = menuClient.childNodes[i];
      if (child.toggled) {
        child.toggled = false;
        break;
      }
  }

  if (elem.data("client") == 'currentRoom') {
    document.getElementById(Clients[0]).toggled = true;
  } else {
    let value;
    for(var i=0; i < menuClient.childNodes.length;i++) {
        let child = menuClient.childNodes[i];
        if (child.value == elem.data("client")) {
          value = true;
          break;
        }
    }
    if (value) {
      document.getElementById(elem.data("client")).toggled = true;
      document.getElementById("noroom").style.display = "none";
    } else {
      document.getElementById("selection").toggled = true;
      document.getElementById("noroom").style.display = "block";
      document.getElementById("noroom").innerHTML = "Client manquant: "+elem.data("client");
    }
  }

  let menuPlugin = document.getElementById('menu-plugin');
  for(var i=0; i < menuPlugin.childNodes.length;i++) {
      let child = menuPlugin.childNodes[i];
      if (child.toggled) {
        child.toggled = false;
        break;
      }
  }
  let value;
  for(var i=0; i < menuPlugin.childNodes.length;i++) {
      let child = menuPlugin.childNodes[i];
      if (child.value == elem.data("plugin")) {
        value = true;
        break;
      }
  }
  if (value) {
    document.getElementById(elem.data("plugin")).toggled = true;
    document.getElementById("noplugin").style.display = "none";
  } else {
    document.getElementById("plugin-selection").toggled = true;
    document.getElementById("noplugin").style.display = "block";
    document.getElementById("noplugin").innerHTML = "Plugin manquant: "+elem.data("plugin");
  }

  document.getElementById("temporisation").value = elem.data("tempo");
  document.getElementById("order").value = elem.data("order");
  document.getElementById("speech").value = elem.data("speech");
  document.getElementById("key").value = elem.data("keys") ? elem.data("keys") : "";
  document.getElementById("hour").value = elem.data("hour");
  document.getElementById("day").value = elem.data("days");
  if (elem.data("exec") == "true") {
    document.getElementById("appel").toggled = false;
    document.getElementById("cron").toggled = true;
  } else {
    document.getElementById("cron").toggled = false;
    document.getElementById("appel").toggled = true;
  }
}


function setModifyParams (value, newTask, create) {
  if (!newTask) {
    document.getElementById("scenario").disabled = value;
    document.getElementById("day").disabled = value;
    document.getElementById("hour").disabled = value;
    document.getElementById("type").disabled = value;
    document.getElementById("task").disabled = (!create) ? value : !value;
    document.getElementById("hour").value = (create ? WFActionSelected.data('hour') : "");
  } else {
    document.getElementById("scenario").disabled = value;
    document.getElementById("type").disabled = value;
    document.getElementById("hour").disabled = !value;
    document.getElementById("task").disabled = !value;
    document.getElementById("hour").value = "";
  }
}



function resetWFparams (value, newTask, create) {
  if (!WFActionSelected) {
    setModifyParams(value, newTask, create);
    document.getElementById("scenario").value = "";
    document.getElementById("appel").toggled = false;
    document.getElementById("cron").toggled = false;
    document.getElementById("day").value = "";
    document.getElementById("hour").value = "";
  } else if (WFActionSelected) {
    setModifyParams(value, newTask, create);
  }

  document.getElementById("task").value = "";

  let menuClient = document.getElementById('menu-client');
  for(var i=0; i < menuClient.childNodes.length;i++) {
      let child = menuClient.childNodes[i];
      if (child.toggled) {
        child.toggled = false;
        break;
      }
  }
  document.getElementById("selection").toggled = true;

  let menuPlugin = document.getElementById('menu-plugin');
  for(var i=0; i < menuPlugin.childNodes.length;i++) {
      let child = menuPlugin.childNodes[i];
      if (child.toggled) {
        child.toggled = false;
        break;
      }
  }
  document.getElementById("plugin-selection").toggled = true;
  document.getElementById("noplugin").style.display = "none";
  document.getElementById("noroom").style.display = "none";

  document.getElementById("temporisation").value = "";
  document.getElementById("order").value = (!newTask) ? "" : "1";
  document.getElementById("speech").value = "";
  document.getElementById("key").value = "";
}


function setWFNode(WFactions, subCount, X, Y, WFparent, callback) {

    if (subCount >= WFactions.length)
      return callback();

    wfCyto.addGraphElement(WFCY, null, null, true)
    .then(elem => wfCyto.addElementName(elem, WFactions[subCount].Name))
    .then(elem => wfCyto.addElementData(elem, 'program', WFactions[subCount].Program))
    .then(elem => wfCyto.addElementData(elem, 'order', WFactions[subCount].Order))
    .then(elem => wfCyto.addElementData(elem, 'client', WFactions[subCount].Client))
    .then(elem => wfCyto.addElementData(elem, 'plugin', WFactions[subCount].Plugin))
    .then(elem => wfCyto.addElementData(elem, 'tempo', WFactions[subCount].Tempo))
    .then(elem => wfCyto.addElementData(elem, 'speech', WFactions[subCount].Speech))
    .then(elem => wfCyto.addElementData(elem, 'exec', WFactions[subCount].Exec))
    .then(elem => {
        return new Promise((resolve, reject) => {
            let keys = WFactions[subCount].Keys;
            if (keys && keys.length > 0 && keys.indexOf("~client=") != -1) {
                keys = keys.substring(0,keys.indexOf("~client="));
                wfCyto.addElementData(elem, 'keys', keys)
                .then(elem => {
                  resolve(elem);
                })
                .catch(err => {
                  reject(err || "Erreur dans l'ajout du node de la tâche "+elem.data('name'));
                })
            } else if (keys && keys.length > 0 && keys.indexOf("client=") != -1) {
                wfCyto.addElementData(elem, 'keys', "")
                .then(elem => {
                  resolve(elem);
                })
                .catch(err => {
                  reject(err);
                })
            } else if (!keys || (keys && keys.length == 0)) {
                wfCyto.addElementData(elem, 'keys', "")
                .then(elem => {
                  resolve(elem);
                })
                .catch(err => {
                  reject(err);
                })
            } else {
              wfCyto.addElementData(elem, 'keys', keys)
              .then(elem => {
                resolve(elem);
              })
              .catch(err => {
                reject(err);
              })
            }
        })
    })
    .then(elem => wfCyto.addElementData(elem, 'hour', WFactions[subCount].Hour))
    .then(elem => wfCyto.addElementData(elem, 'days', WFactions[subCount].Days))
    .then(elem => wfCyto.addElementLabelOnly(elem, WFactions[subCount].Name))
    .then(elem => wfCyto.addElementClass(elem, "WFscenario"))
    .then(elem => wfCyto.addElementImage(elem, __dirname+"/../images/task.png"))
    .then(elem => wfCyto.addElementSize(elem, {width: 45, height: 45}))
    .then(elem => wfCyto.addElementPosition(elem, { x:X, y:Y }))
    .then(elem => {
      return new Promise((resolve, reject) => {
        if (WFparent) {
          let id = random(1, 100000).toString();
            WFCY.add({ group: "edges",
                 data: { id: id,
                         source: WFparent,
                         target: elem.id(),
                        strength : 90
                      }
            })
            WFCY.$('#'+id).addClass("WFEdgeAction");
        }
        WFparent = elem.id();
        resolve(elem);
      })
    })
    .then(elem => {
      wfCyto.onClick(elem, (evt) => {
          selectWFAction (elem);
          setModifyParams(true);
          setWFparams (elem);
          setDisplayActionButtons(true);
      });

      resizeX_WFCY (elem.position('x'));
      /*if (window.innerWidth >= (X + 120 + nodespace + nodesize))
        X = X + 120;
      else {
        X = 50
        Y += ((nodespace * 3) + (nodesize/2));
      }*/

      setWFNode(WFactions, ++subCount, (X + 120), Y, WFparent, callback);
    })
    .catch(err => {
      console.log('err:', err || 'erreur à la création des nodes du scenario');
      return;
    })
}



function addNode(cyto, name, count) {

    return new Promise((resolve, reject) => {
      cyto.getGraph()
      .then(cy => cyto.addGraphElement(cy, null, null, true))
      .then(elem => cyto.addElementName(elem, name))
      .then(elem =>  cyto.addElementLabelOnly(elem, name))
      .then(elem => cyto.addElementClass(elem, "scenario"))
      .then(elem => cyto.addElementImage(elem, __dirname+"/../images/scenariz.png"))
      .then(elem => cyto.addElementSize(elem, {width: 45, height: 45}))
      .then(elem => cyto.addElementPosition(elem, { x:50,
                                                    y:((count == 0) ? (nodespace + (nodesize / 2)) : (((nodespace + nodesize) * count) + (nodespace + (nodesize/2))))
                                                  }))
      .then(elem => cyto.lockElement(elem, true))
      .then(elem => {
          if (window.innerHeight < (((nodespace + nodesize) * count) + (nodespace + nodesize))) {
            document.getElementById('CY').style.height = (((nodespace + nodesize) * count) + (nodespace + nodesize)) + nodespace + "px";
          }
          resolve(elem);
      })
      .catch(err => {
				console.log('err:', err || 'erreur à la création du node scenariz');
        reject();
      })
    })
}


function getScenario (reset, name, next) {

  if (reset == true) {
    cyto.removeGraphElementsByClass('scenario')
    .then(() => {
      return new Promise((resolve, reject) => {
        resetGraph();
        resolve();
      })
    })
    .then(() => {
      let scenarios = ipcRenderer.sendSync('Scenariz', 'getScenarios');
      addScenarios(scenarios, name, next);
    })
    .catch(err => {
      console.log('err:', err || 'erreur dans getScenario');
      notification("Erreur: Impossible d'afficher les scénarios après la suppression");
    })
  } else {
    let scenarios = ipcRenderer.sendSync('Scenariz', 'getScenarios');
    addScenarios(scenarios);
  }
}



function setPlugins () {

    let menuPlugins = document.getElementById('menu-plugin');
    Plugins.forEach(plugin => {
        let menuitem = document.createElement("x-menuitem");
        menuitem.value = plugin.name;
        menuitem.setAttribute('id', plugin.name);
        menuitem.addEventListener('click', () => {
          document.getElementById("noplugin").style.display = "none";
        })
        let icon = document.createElement("x-icon");
        if (plugin.active)
          icon.setAttribute('name', 'notifications-active');
        else
          icon.setAttribute('name', 'notifications');
        let label = document.createElement("x-label");
        label.className = 'small_size';
        label.innerHTML = plugin.name;
        menuitem.appendChild(icon);
        menuitem.appendChild(label);
        menuPlugins.appendChild(menuitem);
    })

    document.getElementById("plugin-selection").toggled = true;
}


function getPlugins () {
  return new Promise((resolve, reject) => {
      let pluginDirs = klawSync('./resources/core/plugins', {nofile: true, depthLimit: 1});
      let count = pluginDirs.length;
      for (plugin in pluginDirs) {
        let pluginDir = pluginDirs[plugin].path.substring(pluginDirs[plugin].path.lastIndexOf("\\") + 1);
        let pluginProps = fs.readJsonSync(pluginDirs[plugin].path+'/'+pluginDir+'.prop', { throws: false });
        Plugins.push({name: pluginDir, active: (pluginProps.modules[pluginDir].active != undefined ? pluginProps.modules[pluginDir].active : true)});
        if (!--count) {
          setPlugins();
          resolve();
        }
      }
  })
}



function setClients () {

  let menuClients = document.getElementById('menu-client');
  Clients.forEach(client => {
      let menuitem = document.createElement("x-menuitem");
      menuitem.value = client;
      menuitem.setAttribute('id', client);
      menuitem.addEventListener('click', () => {
        document.getElementById("noroom").style.display = "none";
      })
      let icon = document.createElement("x-icon");
      icon.setAttribute('name', 'room');
      let label = document.createElement("x-label");
      label.className = 'small_size';
      label.innerHTML = client;
      menuitem.appendChild(icon);
      menuitem.appendChild(label);
      menuClients.appendChild(menuitem);
  })

  document.getElementById("selection").toggled = true;

}



function getClients () {
  return new Promise((resolve, reject) => {
    let clients = ipcRenderer.sendSync('Scenariz', 'getClients');
    _.each(clients, num => {
        Clients.push(num.id);
    });
    setClients ();
    resolve();
  })
}


onload = function() {
  getClients()
  .then(() => getPlugins())
  .then(() => {
    getScenario(false);
  })
}
