
// positionné par défaut ou avec un capteur de présence pour la pièce courante
// Il faut bien savoir où on se trouve...
var Avatar_client;

const {Graph} = require('cyto-avatar');
const {remote, ipcRenderer} = require('electron');
const {BrowserWindow, ipcMain} = remote;
const cron = require('cron').CronJob;
let cyto;
let scenarizWindow;
let job;


exports.cron = function(data){

	if (scenarizWindow) {
		info('Désactivation du cron pendant la création de scénarios');
		return;
	}

	// It's time to check
	// 1: By sensor
	if (Avatar.currentRoom) {
		Avatar_client = Avatar.currentRoom;
	}
	// 2: default
	if (!Avatar_client) {
		Avatar_client = Config.default.client;
	}
	// 3: checking if client is running
	if (!Avatar.Socket.getClientSocket(Avatar_client))
		return info('Scenariz Cron:', 'Pas de client connecté');

	var scenarizdb = require('./scenarizdb')({
			client: Avatar_client, // Ici c'est le current_room par capteur de présence ou récupéré par autre chose ou une valeur par défaut ?
		});
	scenarizdb.cron();

}


exports.unresize = function(callback) {
  callback (["scenarizNode"]);
}


// Sauvegarde du node et des widgets lorsqu'on quitte Avatar
exports.onAvatarClose = function(callback){
  if (cyto)
    cyto.saveAllGraphElements("scenarizNode")
    .then(() => {
      callback();
    })
    .catch(err => {
      console.log('Error saving scenariz element', err)
      callback();
    })
}


exports.addPluginElements = function(CY,cytoscape) {

  //init variable globale module Graph
  cyto = new Graph (CY, __dirname, Config.modules.scenariz);

  // Chargement des éléments sauvegardés
  cyto.loadAllGraphElements()
  .then(elems => {
    if (!elems || elems.length == 0) {
      addScenarizNode(cyto)
      .then(elem => cyto.onClick(elem, (evt) => {
          windowShow();
      }))
      .catch(err => {
        console.log('err:', err || 'erreur à la création du node scenariz');
      })
    } else {
      if (Config.modules.scenariz.node.label)
        cyto.addElementLabelOnly(elems[0], "Scenariz")

      cyto.onClick(elems[0], (evt) => {
          windowShow();
      })
      .catch(err => {
        console.log('err:', err || 'erreur à la création du node scenariz');
      })
    }
  })
  .catch(err => {
    console.log('err:', err || 'erreur à la création du node scenariz');
  })

}



function addScenarizNode(cyto) {

    return new Promise((resolve, reject) => {
      cyto.getGraph()
      .then(cy => cyto.addGraphElement(cy, "scenarizNode"), null, true)
      .then(elem => cyto.addElementName(elem, "scenariz"))
      .then(elem => {
        return new Promise((resolve, reject) => {
          if (Config.modules.scenariz.node.label)
            cyto.addElementLabelOnly(elem, "Scenariz")
          resolve(elem);
        })
      })
      .then(elem => cyto.addElementClass(elem, "scenarizNode"))
      .then(elem => cyto.addElementImage(elem, __dirname+"/assets/images/scenariz.png"))
      .then(elem => cyto.addElementSize(elem, {width: 45, height: 45}))
      .then(elem => cyto.addElementPosition(elem, {x:100, y:100}))
      .then(elem => {
          resolve(elem);
      })
      .catch(err => {
				console.log('err:', err || 'erreur à la création du node scenariz');
        reject();
      })
    })
}



function windowShow () {

  if (scenarizWindow) {
    scenarizWindow.show();
    return;
  }

  let style = {
		minimizable: true,
		alwaysOnTop: false,
    movable: true,
    resizable: false,
    show: false,
    width: 960,
    height: 650,
    title: 'Gestion des Scénarios',
    icon: 'resources/core/plugins/scenariz/assets/images/scenariz.png',
  }

  scenarizWindow = new BrowserWindow(style);
  scenarizWindow.loadFile('../core/plugins/scenariz/assets/html/scenariz.html');
  //scenarizWindow.openDevTools();
  ipcRenderer.sendSync('addPluginWindowID', scenarizWindow.id);
  scenarizWindow.once('ready-to-show', () => {
      scenarizWindow.show();
  });
  scenarizWindow.on('closed', () => {
		ipcMain.removeAllListeners('Scenariz');
		ipcMain.removeAllListeners('getScenario');
		ipcMain.removeAllListeners('createTask');
		ipcMain.removeAllListeners('deleteTask');
		ipcMain.removeAllListeners('testTask');
		ipcMain.removeAllListeners('initTest');
    scenarizWindow = null;
		info('Réactivation du cron...');
  });

	ipcMain.on('Scenariz', (event, arg) => {
    switch (arg) {
      case 'quit':
        let state = ipcRenderer.sendSync('removePluginWindowID', scenarizWindow.id);
        event.returnValue = true;
        scenarizWindow.close();
        break;
			case 'getScenarios':
				let scenarizdb = require('./scenarizdb')({});
				scenarizdb.getScenarios(infos => {
					event.returnValue = infos;
				});
				break;
			case 'getID':
				event.returnValue = scenarizWindow.id;
				break;
			case 'getClients':
				event.returnValue = Avatar.Socket.getClients();
				break;
    }
  })
	.on('initTest', (event, arg) => {
		Avatar.speak("Le test a généré une erreur.", arg);
		event.returnValue = true;
	})
	.on('getScenario', (event, arg) => {
		let scenarizdb = require('./scenarizdb')({});
		scenarizdb.getScenario(arg, infos => {
			event.returnValue = infos;
		});
  })
	.on('createTask', (event, arg) => {
		var scenarizdb = require('./scenarizdb')({});
		scenarizdb.save(arg.program,arg.plugin,arg.name,arg.order,arg.tempo,arg.exec,arg.keys,arg.speech,/*autodestroy*/"false",/*mute*/"true",/*fifo*/"false",/*speechStartOnRecord*/"false",arg.hour,arg.days,arg.client, status => {
			event.returnValue = status;
		});
	})
	.on('deleteTask', (event, arg) => {
		var scenarizdb = require('./scenarizdb')({});
		scenarizdb.remove(arg.program,arg.name, status => {
			event.returnValue = status;
		})
	})
	.on('testTask', (event, arg) => {
		var socketClient = Avatar.Socket.getClientSocket(arg.client);
		if (!socketClient) {
				event.returnValue = 0;
				return;
		}

		timeoutTest(event);
		testTask (arg.client, arg.plugin, arg.keys, arg.speech, (status) => {
			if (job) {
				job.stop();
				job = null;
			}
			event.returnValue = status ? status : 1;
		})
	})

}


function timeoutTest(event) {
	var d = new Date();
	var s = d.getSeconds()+20;
	d.setSeconds(s);

	if (job) job.stop();
	job = new cron(d, function(done) {
    event.returnValue = 2;
	},null, true);
}



exports.action = function(data, callback){

	var tblCommand = {
		// Speak Time, specific for Cron
		setTime : function() {setTime(callback);return},

		// Speak text, specific for Cron
		speech: function() {callback({'tts': data.action.text});return},

		// Exécution d'un scénario
		execCron: function() {execCron(data.client, data.action.program, data.action.timeout ? data.action.timeout : 0)},

		// Sauvegarde d'un scenario par Avatar.call
		saveCron: function() {saveCron(data.client, data.action.program, data.action.name, data.action.exec, data.action.order, data.action.tempo, data.action.plug, data.action.start, data.action.key, data.action.ttsCron, data.action.autodestroy, data.action.mute, data.action.fifo, data.action.speechStartOnRecord, data.action.cronClient, callback)},

		// for removing only one program - careful, only one line!
		removeCron: function() {removeCron(data.client, data.action.program, data.action.name)},

		// Manage scenario
		manageProgram: function() {manageCron(data.client)}
	};

	info("Scenariz command:", data.action.command, "From:", (data.client) ? data.client : 'unknow');
	tblCommand[data.action.command]();

	if (data.action.command != 'setTime' && data.action.command != 'speech' && data.action.command != 'saveCron')
		callback();

}


var setTime = function(callback) {
	var date = new Date();
	var text = date.getHours() + ' heure';
	if (date.getMinutes() > 0)
		text += ' ' + date.getMinutes();
	callback({'tts': text});
}


var saveCron = function (client, program, name, exec, order, tempo, plugin, start, key, tts, autodestroy, mute, fifo, speechStartOnRecord, Client, callback) {

	var tokenize = start.split('-'),
		hour = tokenize.shift(),
		days = tokenize.pop();

	if (!days || !hour)
		return warn("Scenariz: Le format de la date du programme est incorrecte.");

	if (!plugin)
		return warn ("Scenariz: Le plugin du programme est manquant.");

	if (!program)
		return warn ("Le nom du programme est manquant.");

	if (days.toLowerCase() == 'today' || days.toLowerCase() == 'tomorrow' || days.toLowerCase() == 'aftertomorrow' ) {
		days = setDayOfWeek(days);
	}

	exec = ((exec) ? exec : "true");  // execution true by default
	order = ((order) ? order : "1");  // order 1 by default
	tempo = ((tempo) ? tempo : "1000"); // 3s of tempo by default
	tts =  ((tts) ? tts : null); // start tts by ...
	key = ((key) ? key : null);
	Client = ((Client) ? Client : client); //client by default
	autodestroy = ((autodestroy) ? autodestroy : "false" ); // If true, the program is destroyed after execution
	fifo  = ((fifo) ? fifo : "false" ); // first client  executes it then delete
	mute = ((mute) ? mute : "false" );
	speechStartOnRecord = ((speechStartOnRecord) ? speechStartOnRecord : "false" );

	var scenarizdb = require('./scenarizdb')({
			client: client
	});
	scenarizdb.save(program,plugin,name,order,tempo,exec,key,tts,autodestroy,mute,fifo,speechStartOnRecord,hour,days,Client, function(status) {
		if (callback) return callback(status);
	});

}


var removeCron = function (client, program, name) {
	var scenarizdb = require('./scenarizdb')({
			client: client
	});
	scenarizdb.remove(program,name);
}


var execCron = function (client, program, timeout) {
	var scenarizdb = require('./scenarizdb')({
			client: client
	});
	scenarizdb.exec(program,timeout);
}


var manageCron = function (client) {
	var scenarizdb = require('./scenarizdb')({
			client: client,
	});
	scenarizdb.manage();
}



function testTask (client, plugin, keys, speech, callback) {
	let execTask = formatTask(keys);
	Avatar.call(plugin, execTask, cb => {
			if (speech.indexOf("%s") != -1 && cb === undefined) {
				info('Test tâche: Le tts %s est manquant dans le callback de la fonction')
				return callback(2);
			}
			speechText(client, speech, cb, callback);
	})
}


function speechText(client, speech, cb, callback) {
	if (speech) {
			if (cb && cb.tts && cb.tts.length > 0) {
					if (speech.indexOf("%s") != -1) {
						speech = speech.replace ('%s', cb.tts);

						if (speech.indexOf("@@") != -1) {
							multiSpeak(speech, client, function() {
								Avatar.Speech.end(client,null, function() {
									callback();
								});
							});
						} else {
							Avatar.speak(speech, client, function(){
								Avatar.Speech.end(client, null, function() {
									callback();
								});
							});
						}
					} else {
						if (speech.indexOf("@@") != -1) {
							multiSpeak(speech, client, function() {
								Avatar.Speech.end(client, null, function() {
										callback();
								});
							});
						} else {
							Avatar.speak(speech, client, function () {
								Avatar.speak(cb.tts, client, function(){
									Avatar.Speech.end(client, null, function() {
											callback();
									});
								});
							});
						}
					}
			} else {
				if (speech.indexOf("@@") != -1) {
					multiSpeak(speech, client, function() {
						Avatar.Speech.end(client, null, function() {
							callback();
						});
					});
				} else {
					Avatar.speak(speech, client, function(){
						Avatar.Speech.end(client, null, function() {
							 callback();
						});
					});
				}
			}
	} else {
		if (cb && cb.tts && cb.tts.length > 0) {
			if (cb.tts.indexOf("@@") != -1) {
					multiSpeak(cb.tts, client, function() {
						Avatar.Speech.end(client, null, function() {
								callback();
						});
					});
			} else {
				Avatar.speak(cb.tts, client, function(){
					Avatar.Speech.end(client,null, function() {
							callback();
					});
				});
			}
		} else {
				callback();
		}
	}
}


function multiSpeak (speech, client, callback) {
	var tblSpeech = speech.split('@@');
	scenarizSpeak(tblSpeech,0,client,scenarizSpeak,callback);
}


function scenarizSpeak (tblSpeech,pos,client,callback,callbackNext) {

	if (pos == tblSpeech.length) {
		if (callbackNext) callbackNext();
		return;
	}

	Avatar.speak(tblSpeech[pos], client, function(){
		setTimeout(function(){
			callback(tblSpeech,++pos,client,callback,callbackNext);
		}, parseInt(500));
	});
}



function formatTask (task) {
	var keys={};
	if (task != undefined) {
		keys.action = {};
		var options, option;
		options = task.split('~');
		for (var i=0;i<options.length;i++) {
			option = options[i].split('=');
			if (option[0] == 'client')
				keys[option[0]] = option[1];
			 else
				keys.action[option[0]] = option[1];
		}
	}
	return keys;
}
