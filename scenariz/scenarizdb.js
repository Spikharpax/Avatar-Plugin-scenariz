/*
	Author: Stéphane Bascher
	Specific Scenarios Cron management for Avatar
	*/
const moment = require('moment');
const	fs = require('fs');
moment.locale('fr');

// Init js
var nedbClient = module.exports = function (opts) {
	//Dirty hack
	var nedbobj = this;

	if (!(this instanceof nedbClient)) {
		return new nedbClient(opts);
	}

	opts = opts || {};
	this.avatar_client = opts.client ? opts.client : null;
	this.debug = true;
	// French language, see the FR_fr.js file in the lang folder
	this.lang = 'FR_fr';
	this.msg = this.msg || require('./lang/' + this.lang);
	this.Scenarizdb = this.Scenarizdb || this.dbinit();
	this.ScenarizdbnoCron = this.ScenarizdbnoCron || this.dbinitnoCron();

	// Save action
	this.save = function (program,plugin,name,order,tempo,exec,key,tts,autodestroy,mute,fifo,speechStartOnRecord,hour,days,clients,callback) {this.dbsave(program,plugin,name,order,tempo,exec,key,tts,autodestroy,mute,fifo,speechStartOnRecord,hour,days,clients,function(status) {
		callback(status);
		}
	)};
	//remove cron
	this.remove	= function (program, name, callback) {this.removeCron(program,name, (status => {
		if (callback)  callback(status);
	}))};
	// Exec action
	this.exec = function (program,timeout) {this.dbexec(program,timeout,nedbobj,nedbobj.callback_play)};
	// execute Cron action
	this.cron = function () {this.dbcron(this.Scenarizdb, function (tbl_pl_list) {
									nedbobj.callback_play(tbl_pl_list,1,nedbobj,nedbobj.callback_play, function () {
										nedbobj.dbcron(nedbobj.ScenarizdbnoCron, function (tbl_pl_list_nocron) {
											nedbobj.callback_play(tbl_pl_list_nocron,1,nedbobj,nedbobj.callback_play, function() {
												nedbobj.removeNoCron(nedbobj.ScenarizdbnoCron,tbl_pl_list_nocron,0,nedbobj.removeNoCron, function () {
													nedbobj.removeAutoDestroys(nedbobj.Scenarizdb,nedbobj);
												});
											});
										});
									});
								});
							};

	this.manage = function () {this.dbmanage()};

	this.getScenarios = function (callback) {this.dbGetScenarios(scenariosList => {
		callback(scenariosList);
	})};
	this.getScenario = function (name, callback) {this.dbGetScenario(name, scenarioList => {
		callback(scenarioList);
	})};
}


// Init nedb database
nedbClient.prototype.dbinit = function () {
	var dbstore = require('nedb'),
	    dbfile = __dirname + '/db/Scenariz.db',
	    db = new dbstore({ filename: dbfile});
	db.loadDatabase();
	return db;
}



// Init nedb noCron database
nedbClient.prototype.dbinitnoCron = function () {
	var dbstore = require('nedb'),
		dbfile = __dirname + '/db/ScenariznoCron.db',
		dbnoCron = new dbstore({ filename: dbfile});
	dbnoCron.loadDatabase();
	return dbnoCron;
}



nedbClient.prototype.removeNoCron = function (db, docs, pos, callback, callbackNext) {

	if (!callback || pos == docs.length) return callbackNext();
	db.remove({ _id: docs[pos]._id }, function (err, numRemoved) {
		setTimeout(function(){
			callback(db,docs,++pos,callback, callbackNext);
		}, 500);
	});
}


nedbClient.prototype.removeAutoDestroys = function (db,client) {

	var date = moment().format("YYYY-MM-DD"),
		currentDate = moment().format("YYYY-MM-DDTHH:mm"),
		substractdate = moment(currentDate).subtract(5, 'minutes').format("YYYY-MM-DDTHH:mm");

	db.find({ Autodestroy : "true" }, function (err, docs) {
		if (err){
			error("Enable to retrieve db autodestroy items, error:", err);
			return;
		}

		var tbl_pl_list = [],
		    pending = docs.length;

		if (pending > 0) {
			docs.forEach(function (doc) {
				if (isday(doc.Days)){
					doc.Hour =  ((doc.Hour.indexOf (':') == 1) ? '0'+ doc.Hour : doc.Hour);
					var docDate = date+'T'+doc.Hour;

					if (moment(docDate).isBefore(substractdate) == true  || moment(docDate).isSame(substractdate)== true )
						tbl_pl_list.push(doc);
				}
				if (!--pending) {
					//if (client.debug == true) info("nb autodestroy docs:", tbl_pl_list.length);
					client.removeAutoDestroy (db,tbl_pl_list,0,client,client.removeAutoDestroy);
				}
			});
		}
	});

}


nedbClient.prototype.removeCron = function (program,name, callback) {
	var client = this;

	client.Scenarizdb.findOne({Program:program, Name:name}, function (err, doc) {
			if (err){
				error("Enable to retrieve Scenariz Cron, error:", err);
				return callback(false);
			}
			if (doc) {
				client.Scenarizdb.remove({ _id: doc._id }, function (err, numRemoved) {
					if (err) {
						error("Enable to retrieve Scenariz Cron, error:", err);
						return callback(false);
				  }

					callback(true);
				});
			}
	});
}

nedbClient.prototype.removeAutoDestroy = function (db,docs,pos,client,callback) {

	if (!callback || pos == docs.length) return;

	// Added after used this plugin to program tv channel, the way is to remove the program after its execution.
	// A Autodestroy key added.
	db.remove({ _id: docs[pos]._id }, function (err, numRemoved) {
		setTimeout(function(){
			callback(db,docs,++pos,callback);
		}, 500);
	});
}




// Ajout pour dictaphone
var multiSpeak = function (Speech, client, callbackNext) {

	var tblSpeech = Speech.split('@@');
	scenarizSpeak(tblSpeech,0,client,scenarizSpeak,callbackNext);

}

var scenarizSpeak = function (tblSpeech,pos,client,callback,callbackNext) {

	if (pos == tblSpeech.length)
		return callbackNext();

	Avatar.speak(tblSpeech[pos], client, function(){
		setTimeout(function(){
			callback(tblSpeech,++pos,client,callback,callbackNext);
		}, parseInt(500));
	});

}


nedbClient.prototype.dbGetScenario = function(name, callback) {
	var client = this;

	client.Scenarizdb.find({Program: name}, function (err, docs) {
		if (err || docs.length == 0)
			return callback([]);

			callback(docs);
	})
}


nedbClient.prototype.dbGetScenarios = function(callback) {
	var client = this;

	client.Scenarizdb.find({}, function (err, docs) {
		let scenariosList = [];
		if (err || docs.length == 0){
			return callback(scenariosList);
		} else {
			var pending = docs.length;
			docs.forEach(function (doc) {
				if (scenariosList.indexOf(doc.Program) == -1 && doc.Order == "1" && (doc.Autodestroy && doc.Autodestroy == 'false' || !doc.Autodestroy))
					scenariosList.push(doc.Program);

				if (!--pending) {
					callback(scenariosList);
				}
			});
		}
	})
}





nedbClient.prototype.dbmanage = function () {
	var client = this;
	client.Scenarizdb.find({}, function (err, docs) {
		if (err){
			error("Enable to retrieve programs, error: " + err);
			return;
		}

		if (docs.length == 0)
			Avatar.speak(client.msg.err_localized('no_cron'), client.avatar_client, function(){
				Avatar.Speech.end(client.avatar_client);
			});
		else {
			var pending = docs.length,
			    progList = [];

			docs.forEach(function (doc) {
				if (progList && progList.indexOf(doc.Program) == -1)
					progList.push(doc.Program);

				if (!--pending) {
					if (progList.length > 1) {
						Avatar.speak(client.msg.localized('nbCron').replace('%d',progList.length), client.avatar_client, function() {
							setTimeout(function(){
								askCron(progList,0,client,"up",askCron);
							}, 1000);
						});
					} else {
						askCron(progList,0,client,"up",askCron);
					}
				}
			});
		}
	});

}


var askCron = function (progList,pos,client,sens,callback) {

	if (!callback) return;
	if (pos < 0 || pos == progList.length) {
		if (pos < 0)
			var tts = client.msg.localized('nbminCron')
		else if (pos == progList.length)
			var tts = client.msg.localized('nbmaxCron')

		Avatar.askme(tts, client.avatar_client,
		Config.modules.scenariz.askme.debut_fin_list,
		0, function(answer, end){
				switch (answer) {
				case 'sommaire':
					end(client.avatar_client);
					//if (client.debug == true) info("Summary:", client.msg.localized('askToBegin'));
					Avatar.speak(client.msg.localized('askToBegin'), client.avatar_client, function(){
						askCron(progList,pos,client,sens,callback);
					});
					break;
				case 'yes':
					end(client.avatar_client);
					callback (progList,0,client,"up",callback);
					break;
				case 'cancel':
				default:
					Avatar.speak(client.msg.localized('terminateCron'), client.avatar_client, function() {
						end(client.avatar_client, true);
					});
					break;
				}
		});
	} else {
		askTo(progList,pos,client,sens,function (pos,sens) {
			if (sens == "up") ++pos;
			if (sens == "down") --pos;
			callback(progList,pos,client,sens,callback)
		});
	}

}



var askTo = function (progList,pos,client,sens,callback) {

	Avatar.askme(client.msg.localized('modifycron').replace('%s', progList[pos]) , client.avatar_client,
	Config.modules.scenariz.askme.select_program
	, 0, function(answer, end){
			switch (answer) {
			case 'sommaire':
				end(client.avatar_client);
				//if (client.debug == true) info("Summary:", client.msg.localized('askTosommaire'));
				Avatar.speak(client.msg.localized('askTosommaire'), client.avatar_client, function(){
					callback(((sens == "up") ? --pos : ++pos),sens);
				});
				break;
			case 'sens':
				end(client.avatar_client);
			    var tts = ((sens == "up") ? client.msg.localized('cron_sens_up') : client.msg.localized('cron_sens_down'));
				//if (client.debug == true) info("The sens is", sens);
				Avatar.speak(tts, client.avatar_client ,function(){
					callback(((sens == "up") ? --pos : ++pos),sens);
				});
				break;
			case 'yes':
				end(client.avatar_client);
				//if (client.debug == true) info("Modification:", progList[pos]);
				Avatar.speak(client.msg.localized('selectedcron').replace('%s', progList[pos]), client.avatar_client, function(){
				    askModifyCron(progList[pos],client.msg.localized('askModifyCron'),client);
				});
				break;
			case 'SARAHcancel':
			case 'Sarahcancel':
				Avatar.speak(client.msg.random_localized('terminateSarahAsk'), client.avatar_client, function() {
					end(client.avatar_client, true);
				});
				break;
			case 'cancel':
				//if (client.debug == true) info("Cancel modification");
				Avatar.speak(client.msg.localized('cancel'), client.avatar_client, function() {
					end(client.avatar_client, true);
				});
				break;
			case 'reverse':
				//if (client.debug == true) info("Reverse sens");
				sens = ((sens == "up") ? "down" : "up");
				end(client.avatar_client);
				callback(pos,sens);
				break;
			case 'no':
			default:
				//if (client.debug == true) info("Next Program");
				end(client.avatar_client);
				callback(pos,sens);
				break;
			}
	});
}




var askModifyCron = function (program,tts,client){

	Avatar.askme(tts , client.avatar_client,
	Config.modules.scenariz.askme.select_action
	, 0, function(answer, end){
			var tts = client.msg.localized('askModifyCronNext')
			switch (answer) {
			case 'sommaire':
				//if (client.debug == true) info("Summary:", client.msg.localized('askModifySommaire'));
				end(client.avatar_client);
				Avatar.speak(client.msg.localized('askModifySommaire'), client.avatar_client, function(){
					askModifyCron(program,tts,client);
				});
				break;
			case 'state':
				//if (client.debug == true) info("State", program);
				end(client.avatar_client);
				updateCron(program, "state", client, function (state,hour,days,nbactions,hourlast,clients){
					if (clients.toLowerCase() == 'all')
						var ttsState = client.msg.localized('stateAllCron').replace('%s', program).replace('%d', state).replace('%h', hour).replace('%z', hourlast).replace(' 1 ', ' ' + client.msg.localized('1') + ' ');
					else {
						clients = clients.replace('|', client.msg.localized('prefixClients') + ' ');
						var ttsState = client.msg.localized('stateCron').replace('%s', program).replace('%d', state).replace('%c', clients).replace('%h', hour).replace('%z', hourlast).replace(' 1 ', ' ' + client.msg.localized('1') + ' ');
					}
					switch (days) {
						case "1111111":
							ttsState += client.msg.localized('stateWeekdaysCronOn');
						break;
						case "0000000":
							ttsState += client.msg.localized('stateWeekdaysCronOff');
						break;
						case "1111100":
							ttsState += client.msg.localized('stateWorkdaysCronOn');
						break;
						case "0000011":
							ttsState += client.msg.localized('stateWekendCronOn');
						break;
						default:
							var msg = ' ',
								nbdays = 0;
							if (days.substring(0,1) == '1') {nbdays += 1; msg += client.msg.localized('stateMondayCronOn') + ', ';}
							if (days.substring(1,2) == '1') {nbdays += 1 ; msg += client.msg.localized('statetuesdayCronOn') + ', ';}
							if (days.substring(2,3) == '1') {nbdays += 1 ; msg += client.msg.localized('statewednesdayCronOn') + ', ';}
							if (days.substring(3,4) == '1') {nbdays += 1 ; msg += client.msg.localized('statethursdayCronOn') + ', ';}
							if (days.substring(4,5) == '1') {nbdays += 1 ; msg += client.msg.localized('statefridayCronOn') + ', ';}
							if (days.substring(5,6) == '1') {nbdays += 1 ; msg += client.msg.localized('statesaturdayCronOn') + ', ';}
							if (days.substring(6) == '1') {nbdays += 1 ; msg += client.msg.localized('statesundayCronOn') + ', ';}
							switch (nbdays) {
								case 1:
									msg = client.msg.localized('statesresultCronOn').replace('%d', nbdays) + msg;
									break;
								default:
									msg = client.msg.localized('statesresultsCronOn').replace('%d', nbdays) + msg;
									break;
							}
							ttsState += msg;
						break;
					}

					Avatar.speak(ttsState, client.avatar_client, function(){
						askModifyCron(program,tts,client);
					});
				});
				break;
			case 'activate':
			   //if (client.debug == true) info("Activate", program);
			   end(client.avatar_client);
			   updateCron(program, "true", client, function (numReplaced){
					Avatar.speak(client.msg.localized('activateCron').replace('%s', program), client.avatar_client, function(){
						askModifyCron(program,tts,client);
					});
				});
				break;
			case 'desactivate':
				//if (client.debug == true) info("Desactivate", program);
				end(client.avatar_client);
				updateCron(program, "false", client, function (numReplaced){
					Avatar.speak(client.msg.localized('desactivateCron').replace('%s', program), client.avatar_client, function(){
						askModifyCron(program,tts,client);
					});
				});
				break;
			case 'minute':
				//if (client.debug == true) info("Changing minute for", program);
				end(client.avatar_client);
				updateCron(program, "minute", client, function (diff,numReplaced,newHour){
					switch (diff) {
						case false:
							Avatar.speak(client.msg.localized('cancel'), client.avatar_client, function(){
								askModifyCron(program,tts,client);
							});
						break;
						case 0:
							Avatar.speak(client.msg.localized('noModificationCron').replace('%s', program), client.avatar_client, function(){
								askModifyCron(program,tts,client);
							});
						break;
						default:
							var newtts = client.msg.localized('modifyMinuteCron').replace('%h', diff).replace('%s', program);
							newtts += client.msg.localized('NewHourCron').replace('%s', newHour);

							Avatar.speak(newtts, client.avatar_client, function(){
								askModifyCron(program,tts,client);
							});
						break;
					}
				});
				break;
			case 'hour':
				//if (client.debug == true) info("Changing hour for", program);
				end(client.avatar_client);
				updateCron(program, "hour", client, function (diff,numReplaced,newHour){
					switch (diff) {
						case false:
							Avatar.speak(client.msg.localized('cancel'), client.avatar_client, function(){
								askModifyCron(program,tts,client);
							});
						break;
						case 0:
							Avatar.speak(client.msg.localized('noModificationCron').replace('%s', program), client.avatar_client, function(){
								askModifyCron(program,tts,client);
							});
						break;
						default:
							var newtts = client.msg.localized('modifyHourCron').replace('%h', diff).replace('%s', program);
							newtts += client.msg.localized('NewHourCron').replace('%s', newHour);

							Avatar.speak(newtts, client.avatar_client, function(){
								askModifyCron(program,tts,client);
							});
						break;
					}
				});
				break;
			case 'day':
				//if (client.debug == true) info("Changing date for", program);
				end(client.avatar_client);
				updateCron(program, "day", client, function (days){
					switch (days) {
						case false:
							Avatar.speak(client.msg.localized('cancel'), client.avatar_client, function(){
								askModifyCron(program,tts,client);
							});
						break;
						case 0:
							Avatar.speak(client.msg.localized('noModificationCron').replace('%s', program), client.avatar_client, function(){
								askModifyCron(program,tts,client);
							});
						break;
						default:
							Avatar.speak(client.msg.localized('modifyDaysCron').replace('%s', program), client.avatar_client, function(){
								askModifyCron(program,tts,client);
							});
						break;
					}
				});
				break;
			case 'delete':
				end(client.avatar_client);
				//if (client.debug == true) info("Delete", program);
				updateCron(program, "delete", client, function (numRemoved){
					switch (numRemoved) {
						case 0:
							Avatar.speak(client.msg.localized('noModificationCron').replace('%s', program), client.avatar_client, function(){
								askModifyCron(program,tts,client);
							});
						break;
						default:
							Avatar.speak(client.msg.localized('deleteCron').replace('%s', program), client.avatar_client, function(){
								client.dbmanage();
								//askModifyCron(program,tts,client);
							});
						break;
					}
				});
				break;
			case 'SARAHcancel':
			case 'Sarahcancel':
				Avatar.speak(client.msg.random_localized('terminateSarahAsk'), client.avatar_client, function() {
					end(client.avatar_client, true);
				});
				break;
			case 'cancel':
			default:
				Avatar.speak(client.msg.localized('terminateCron'), client.avatar_client, function() {
					end(client.avatar_client, true);
				});
				break;
			}
	});

}




var updateCron = function (cron, state, client, callback){

	switch (state)  {
		case 'state':
			client.Scenarizdb.find({Program: cron, Order:'1'}, function (err, docs) {
				var pending = docs.length,
				    hour,
					hourlast,
					clients,
					days,
				    date = moment().format("YYYY-MM-DD");
				docs.forEach(function (doc) {
					if (hour) {
						if ( moment(date+'T'+doc.Hour).isBefore(date+'T'+hour) == true) {
							hour = doc.Hour;
							state = ((doc.Exec == "false") ? client.msg.localized('desactivatedCron') : client.msg.localized('activatedCron'));
							days = doc.Days;
							clients = doc.Client;
						}
					} else {
						hour = doc.Hour;
						state= ((doc.Exec == "false") ? client.msg.localized('desactivatedCron') : client.msg.localized('activatedCron'));
						days = doc.Days;
						clients = doc.Client;
					}

					if (hourlast) {
						if ( moment(date+'T'+doc.Hour).isAfter(date+'T'+hourlast) == true) {
							hourlast = doc.Hour;
						}
					} else
						hourlast = doc.Hour;

					if (!--pending) {
						client.Scenarizdb.find({Program: cron}, function (err, docs) {
							callback(state,hour,days,docs.length,hourlast,clients);
						});
					}
				});
			});
			break;
		case 'hour':
		case 'minute':
		case 'day':
			client.Scenarizdb.find({Program: cron, Order:'1'}, function (err, docs) {
				var pending = docs.length,
				    hour,
					hourMns,
					minute,
					days,
				    date = moment().format("YYYY-MM-DD");
				docs.forEach(function (doc) {
					if (hourMns) {
						if ( moment(date+'T'+doc.Hour).isBefore(date+'T'+hourMns) == true) {
							hourMns = doc.Hour;
							minute = doc.Hour.split(':').pop();
							hour = doc.Hour.split(':').shift();
							days = doc.Days;
						}
					} else {
						hourMns = doc.Hour;
						minute = doc.Hour.split(':').pop();
						hour = doc.Hour.split(':').shift();
						days = doc.Days;
					}

					if (!--pending) {
						client.Scenarizdb.find({Program: cron}, function (err, docs) {
							switch (state)  {
								case 'hour':
									askHour (hour, minute, docs, hour, client, askHour, function(diff, newHour) {
										callback(diff,docs.length,newHour);
									});
									break;
								case 'minute':
									askMinute (hour, minute, docs, minute, client, askMinute, function(diff, newHour) {
										callback(diff,docs.length,newHour);
									});
									break;
								case 'day':
									askDays (cron, days, client.msg.localized('activatedCron'), docs, days, client, askDays, function(days) {
										callback(days);
									});
									break;
							}
						});
					}
				});
			});
			break;
		case 'true':
		case 'false':
			client.Scenarizdb.update({Program:cron}, { $set: {Exec: state}}, { multi: true }, function (err, numReplaced) {
				if (err) {
					error("Enable to retrieve program:", err);
					numReplaced = 0;
				}
				callback(numReplaced);
			});
			break;
		case 'delete':
			Avatar.askme(client.msg.localized('askDeleteCron'), client.avatar_client,
			Config.modules.scenariz.askme.delete_program
			, 0, function(answer, end){
				end(client.avatar_client);
				switch (answer) {
					case 'deleteCron':
						client.Scenarizdb.remove({Program:cron}, { multi: true }, function (err, numRemoved) {
							if (err) {
								error("Enable to delete program, error:", err);
								numRemoved = 0;
							}
							callback(numRemoved);
						});
						break;
					case 'cancel':
					default:
						callback(0);
						break;
				}
			});
	}
}



var askDays = function (cron, days, state, docs, currentdays, client, callback, callbackNext){

	var tts = client.msg.localized('askWeekdaysCron').replace('%s', ' ' + state);
	Avatar.askme(tts, client.avatar_client,
	Config.modules.scenariz.askme.modify_days,
	0, function(answer, end){
		end(client.avatar_client);
		switch (answer) {
			case 'sommaire':
				//if (client.debug == true) info("Summary:", client.msg.localized('askDaysSommaire'));
				Avatar.speak(client.msg.localized('askDaysSommaire'), client.avatar_client, function(){
					callback (cron, days, state, docs, currentdays, client, callback, callbackNext);
				});
				break;
			case 'activate':
			case 'desactivate':
				state = ((state == client.msg.localized('activatedCron')) ? client.msg.localized('desactivatedCron') : client.msg.localized('activatedCron'));
				callback (cron, days, state, docs, currentdays, client, callback, callbackNext);
				break;
			case 'workdays':
				days = ((state == client.msg.localized('activatedCron')) ? "1111100" : "0000011");
				var tts = ((state == client.msg.localized('activatedCron')) ? client.msg.localized('workdaysOn') : client.msg.localized('workdaysOff'));
				Avatar.speak(tts, client.avatar_client, function(){
					callback (cron, days, state, docs, currentdays, client, callback, callbackNext);
				});
				break;
			case 'weekdays':
				days = ((state == client.msg.localized('activatedCron')) ? "1111111" : "0000000");
				var tts = ((state == client.msg.localized('activatedCron')) ? client.msg.localized('weekdaysOn') : client.msg.localized('weekdaysOff'));
				Avatar.speak(tts, client.avatar_client, function(){
					callback (cron, days, state, docs, currentdays, client, callback, callbackNext);
				});
				break;
			case 'monday':
				days = ((state == client.msg.localized('activatedCron'))
						? '1' + days.substring(1) : '0' + days.substring(1));
				var tts = ((state == client.msg.localized('activatedCron')) ? client.msg.localized('mondayOn') : client.msg.localized('mondayOff'));
				Avatar.speak(tts, client.avatar_client, function(){
					callback (cron, days, state, docs, currentdays, client, callback, callbackNext);
				});
				break;
			case 'tuesday':
				days = ((state == client.msg.localized('activatedCron'))
						? days.substring(0,1) + '1' + days.substring(2) : days.substring(0,1) + '0' + days.substring(2));
				var tts = ((state == client.msg.localized('activatedCron')) ? client.msg.localized('tuesdayOn') : client.msg.localized('tuesdayOff'));
				Avatar.speak(tts, client.avatar_client, function(){
					callback (cron, days, state, docs, currentdays, client, callback, callbackNext);
				});
				break;
			case 'wednesday':
				days = ((state == client.msg.localized('activatedCron'))
						? days.substring(0,2) + '1' + days.substring(3) : days.substring(0,2) + '0' + days.substring(3));
				var tts = ((state == client.msg.localized('activatedCron')) ? client.msg.localized('wednesdayOn') : client.msg.localized('wednesdayOff'));
				Avatar.speak(tts, client.avatar_client, function(){
					callback (cron, days, state, docs, currentdays, client, callback, callbackNext);
				});
				break;
			case 'thursday':
				days = ((state == client.msg.localized('activatedCron'))
						? days.substring(0,3) + '1' + days.substring(4) : days.substring(0,3) + '0' + days.substring(4));
				var tts = ((state == client.msg.localized('activatedCron')) ? client.msg.localized('thursdayOn') : client.msg.localized('thursdayOff'));
				Avatar.speak(tts, client.avatar_client, function(){
					callback (cron, days, state, docs, currentdays, client, callback, callbackNext);
				});
				break;
			case 'friday':
				days = ((state == client.msg.localized('activatedCron'))
						? days.substring(0,4) + '1' + days.substring(5) : days.substring(0,4) + '0' + days.substring(5));
				var tts = ((state == client.msg.localized('activatedCron')) ? client.msg.localized('fridayOn') : client.msg.localized('fridayOff'));
				Avatar.speak(tts, client.avatar_client, function(){
					callback (cron, days, state, docs, currentdays, client, callback, callbackNext);
				});
			case 'saturday':
				days = ((state == client.msg.localized('activatedCron'))
						? days.substring(0,5) + '1' + days.substring(6) : days.substring(0,5) + '0' + days.substring(6));
				var tts = ((state == client.msg.localized('activatedCron')) ? client.msg.localized('saturdayOn') : client.msg.localized('saturdayOff'));
				Avatar.speak(tts, client.avatar_client, function(){
					callback (cron, days, state, docs, currentdays, client, callback, callbackNext);
				});
				break;
			case 'sunday':
				days = ((state == client.msg.localized('activatedCron'))
						? days.substring(0,6) + '1' : days.substring(0,6) + '0');
				var tts = ((state == client.msg.localized('activatedCron')) ? client.msg.localized('sundayOn') : client.msg.localized('sundayOff'));
				Avatar.speak(tts, client.avatar_client, function(){
					callback (cron, days, state, docs, currentdays, client, callback, callbackNext);
				});
				break;
			case 'yes':
				if (days != currentdays ) {
					client.Scenarizdb.update({Program:cron}, { $set: {Days: days}}, { multi: true }, function (err, numReplaced) {
						if (err) {
							error("Enable to retrieve program, error:", err);
							numReplaced = 0;
						}
						callbackNext(numReplaced);
					});
				} else
					callbackNext(0);
				break;
			case 'cancel':
				callbackNext(false);
				break;
			default:
				callbackNext(0);
				break;
		}
	});
}



var askHour = function (hour, minute, docs, currenthour, client, callback, callbackNext){

	var tts = client.msg.localized('currentHourCron').replace('%s', hour);
	Avatar.askme(tts, client.avatar_client,
	Config.modules.scenariz.askme.modify_hour,
	0, function(answer, end){
		end(client.avatar_client);
		switch (answer) {
			case 'sommaire':
				//if (client.debug == true) info("Summary:", client.msg.localized('askHourSommaire'));
				Avatar.speak(client.msg.localized('askHourSommaire'), client.avatar_client, function(){
					callback (hour, minute, docs, currenthour, client, callback, callbackNext);
				});
				break;
			case 'minus':
				hour = (((parseInt(hour) - 1) < 0) ? (23).toString() : (parseInt(hour) - 1).toString());
				callback (hour.toString(), minute, docs, currenthour, client, callback, callbackNext);
				break;
			case 'minusby15':
				hour = (((parseInt(hour) - 5) < 0) ? (23).toString() : (parseInt(hour) - 5).toString());
				callback (hour.toString(), minute, docs, currenthour, client, callback, callbackNext);
				break;
			case 'more':
				hour = (((parseInt(hour) + 1) > 23) ? (0).toString() : (parseInt(hour) + 1).toString());
				callback (hour.toString(), minute, docs, currenthour, client, callback, callbackNext);
				break;
			case 'moreby15':
				hour = (((parseInt(hour) + 5) > 23) ? (0).toString() : (parseInt(hour) + 5).toString());
				callback (hour.toString(), minute, docs, currenthour, client, callback, callbackNext);
				break;
			case 'yes':
				hour =  ((hour.length == 1) ? '0'+ hour : hour);
				var newHour = moment().format("YYYY-MM-DD") + 'T' + hour +':' + minute;
				var oldhour =  moment().format("YYYY-MM-DD") + 'T' + currenthour +':' + minute;
				if (moment(oldhour).isSame(newHour) == false ) {
					var diffHour = parseInt(hour) - parseInt(currenthour);
					setCronHour (diffHour, docs, 0, client, setCronHour, function (diffHour) {
						if (diffHour < 0)
							diffHour = diffHour * -1;
						callbackNext(diffHour, hour +':' + minute);
					});
				} else
					callbackNext(0);
				break;
			case 'cancel':
				callbackNext(false);
				break;
			default:
				callbackNext(0);
				break;
		}
	});
}




var askMinute = function (hour, minute, docs, currentminute, client, callback, callbackNext){

	var tts = client.msg.localized('currentMinuteCron').replace('%s', minute);
	Avatar.askme(tts, client.avatar_client,
	Config.modules.scenariz.askme.modify_minutes,
	0, function(answer, end){
		end(client.avatar_client);
		switch (answer) {
			case 'sommaire':
				//if (client.debug == true) info("Summary:", client.msg.localized('askHourSommaire'));
				Avatar.speak(client.msg.localized('askHourSommaire'), client.avatar_client, function(){
					callback (hour, minute, docs, currentminute, client, callback, callbackNext);
				});
				break;
			case 'minus':
				minute = (((parseInt(minute) - 5) < 0) ? (55).toString() : (parseInt(minute) - 5).toString());
				callback (hour, minute.toString(), docs, currentminute, client, callback, callbackNext);
				break;
			case 'minusby15':
				minute = (((parseInt(minute) - 15) < 0) ? (55).toString() : (parseInt(minute) - 15).toString());
				callback (hour, minute.toString(), docs, currentminute, client, callback, callbackNext);
				break;
			case 'more':
				minute = (((parseInt(minute) + 5) > 55) ? (0).toString() : (parseInt(minute) + 5).toString());
				callback (hour, minute.toString(), docs, currentminute, client, callback, callbackNext);
				break;
			case 'moreby15':
				minute = (((parseInt(minute) + 15) > 55) ? (0).toString() : (parseInt(minute) + 15).toString());
				callback (hour, minute.toString(), docs, currentminute, client, callback, callbackNext);
				break;
			case 'yes':
				minute =  ((minute.length == 1) ? '0'+ minute : minute);
				var newHour = moment().format("YYYY-MM-DD") + 'T' + hour +':' + minute;
				var oldhour =  moment().format("YYYY-MM-DD") + 'T' + hour +':' + currentminute;
				if (moment(oldhour).isSame(newHour) == false ) {
					var diffMn = parseInt(minute) - parseInt(currentminute);
					setCronMn (diffMn, docs, 0, client, setCronMn, function (docs) {
						if (diffMn < 0)
							diffMn = diffMn * -1;
						callbackNext(diffMn, hour +':' + minute);
					});
				} else
					callbackNext(0);
				break;
			case 'cancel':
				callbackNext(false);
				break;
			default:
				callbackNext(0);
				break;
		}
	});
}


var setCronMn = function (diffMn, docs, pos, client, callback, callbackNext){

	if (pos == docs.length) return callbackNext(diffMn);

	//if (client.debug == true) info("docs.length:", docs.length, 'et pos: ', pos );
	var doc = docs[pos],
		newHour = moment().format("YYYY-MM-DD") + 'T' + doc.Hour,
		diff;

	//if (client.debug == true) info("diff minutes:", diffMn);
	if (diffMn >= 0)
		newHour = moment(newHour).add(diffMn, 'minutes').format("HH:mm");
	else {
		diff = diffMn * -1;
		newHour = moment(newHour).subtract(diff, 'minutes').format("HH:mm");
	}
	//if (client.debug == true) info("new hour pour", doc.Name, ':', newHour);
	newHour =  ((newHour.indexOf (':') == 1) ? '0'+ newHour : newHour);
	client.Scenarizdb.update({_id: doc._id}, { $set: {Hour: newHour}}, {}, function (err, numReplaced) {
		if (err)
			error("Enable to update", doc.Name, 'error:', err);
	    if (numReplaced == 0)
			error("Enable to update", doc.Name);

		callback(diffMn, docs, ++pos, client, callback, callbackNext);
	});


}

var setCronHour = function (diffHour, docs, pos, client, callback, callbackNext){

	if (pos == docs.length) return callbackNext(diffHour);

	//if (client.debug == true) info("docs.length:", docs.length, 'et pos:', pos);
	var doc = docs[pos],
		newHour = moment().format("YYYY-MM-DD") + 'T' + doc.Hour,
		diff;

	//if (client.debug == true) info("diff Hour:", diffHour);
	if (diffHour >= 0)
		newHour = moment(newHour).add(diffHour, 'hours').format("HH:mm");
	else {
		diff = diffHour * -1;
		newHour = moment(newHour).subtract(diff, 'hours').format("HH:mm");
	}
	//if (client.debug == true) info("new hour pour", doc.Name, ':', newHour);
	newHour =  ((newHour.indexOf (':') == 1) ? '0'+ newHour : newHour);
	client.Scenarizdb.update({_id: doc._id}, { $set: {Hour: newHour}}, {}, function (err, numReplaced) {
		if (err)
			error("Enable to update", doc.Name, 'error:', err);
	    if (numReplaced == 0)
			error("Enable to update", doc.Name);

		callback(diffHour, docs, ++pos, client, callback, callbackNext);
	});
}




// Execute the module
nedbClient.prototype.callback_play = function (tbl_pl_list,next,client,callback,callbackNext) {

	if (!callback) return;
	if (next > tbl_pl_list.length) {
		if (callbackNext) {
			return callbackNext();
		} else {
			return;
		}
	}

	var pl = {};
	for (var i=0;i<tbl_pl_list.length;i++) {
		pl = tbl_pl_list[i];
		if (parseInt(pl.Order) == next)
			break;
	}

	if (!Avatar.exists(pl.Plugin)) {
		error('La programmation a échouée, le plugin '+ pl.Plugin + 'n\'existe pas')
		setTimeout(function(){
			callback(tbl_pl_list,++next,client,callback,callbackNext);
		}, parseInt(pl.Tempo));
		return;
	}

	var ExecTask = {};
	ExecTask = formatTask(pl.Keys);

	Avatar.call(pl.Plugin, ExecTask, function(cb){
		if(pl.Fifo && pl.Fifo == 'true')
			client.Scenarizdb.remove({ _id: pl._id }, function (err, numRemoved) {});

		// le client doit être connecté
		var socketClients = Avatar.Socket.getClientSocket(pl.Client);
		if (!socketClients) {
			warn('%s is not connected, unable to set action',pl.Client);
			return callback(tbl_pl_list,++next,client,callback,callbackNext);
		}

		if (pl.Speech) {

			Avatar.Speech.mute(pl.Client);

			if (cb && cb.tts && cb.tts.length > 0) {
				if (pl.Speech.indexOf("%s") != -1) {
					pl.Speech = pl.Speech.replace ('%s', cb.tts);
					// Ajout pour découper proprement une phrase
					if (pl.Speech.indexOf("@@") != -1)
						multiSpeak(pl.Speech, pl.Client, function() {
							Avatar.Speech.end(pl.Client,null, function() {
								setTimeout(function(){
									callback(tbl_pl_list,++next,client,callback,callbackNext);
								}, parseInt(pl.Tempo));
							});
						});
					else
						Avatar.speak(pl.Speech, pl.Client, function(){
							Avatar.Speech.end(pl.Client, null, function() {
								setTimeout(function(){
									callback(tbl_pl_list,++next,client,callback,callbackNext);
								}, parseInt(pl.Tempo));
							});
						});
				} else {
					if (pl.Speech.indexOf("@@") != -1)
						multiSpeak(pl.Speech, pl.Client, function() {
							Avatar.Speech.end(pl.Client, null, function() {
								setTimeout(function(){
									callback(tbl_pl_list,++next,client,callback,callbackNext);
								}, parseInt(pl.Tempo));
							});
						});
					else
						Avatar.speak(pl.Speech, pl.Client, function () {
							Avatar.speak(cb.tts, pl.Client, function(){
								Avatar.Speech.end(pl.Client, null, function() {
									setTimeout(function(){
										callback(tbl_pl_list,++next,client,callback,callbackNext);
									}, parseInt(pl.Tempo));
								});
							});
						});
				}
			} else {

				if (pl.Speech.indexOf("@@") != -1)
					multiSpeak(pl.Speech, pl.Client, function() {
						Avatar.Speech.end(pl.Client, null, function() {
							setTimeout(function(){
								callback(tbl_pl_list,++next,client,callback,callbackNext);
							}, parseInt(pl.Tempo));
						});
					});
				else
					Avatar.speak(pl.Speech, pl.Client, function(){
						Avatar.Speech.end(pl.Client, null, function() {
							setTimeout(function(){
								callback(tbl_pl_list,++next,client,callback,callbackNext);
							}, parseInt(pl.Tempo));
						});
					});

			}
		} else {
			if (cb && cb.tts && cb.tts.length > 0) {

				Avatar.Speech.mute(pl.Client);

				if (cb.tts.indexOf("@@") != -1)
						multiSpeak(cb.tts, pl.Client, function() {
							Avatar.Speech.end(pl.Client, null, function() {
								setTimeout(function(){
									callback(tbl_pl_list,++next,client,callback,callbackNext);
								}, parseInt(pl.Tempo));
							});
						});
				else
					Avatar.speak(cb.tts, pl.Client, function(){
						Avatar.Speech.end(pl.Client,null, function() {
							setTimeout(function(){
								callback(tbl_pl_list,++next,client,callback,callbackNext);
							}, parseInt(pl.Tempo));
						});
					});
			} else {
				setTimeout(function(){
					callback(tbl_pl_list,++next,client,callback,callbackNext);
				}, parseInt(pl.Tempo));
			}
		}

	});

}



// Exec cron
nedbClient.prototype.dbexec = function (program, timeout, client, callback) {

	client.Scenarizdb.find({Program:program}, function (err, docs) {
		if (err){
			return error("Enable to retrieve db items, error: ", err);
		}

		var tbl_pl_list = [],
			tbl_pl_list_start = [],
			tbl_pl_list_next = [],
			date = moment().format("YYYY-MM-DD"),
			hour = moment().format("HH:mm"),
			timeHour = moment().add(timeout,'minutes'),
			currentHour = timeHour.format("HH:mm");

		//info("current hour:", currentHour);

		// test si le client demandé est connecté
		for (var e=0; e<docs.length;e++ ) {
			tbl_pl_list.push(docs[e]);
		}

		// Buble sort
		for (var i=0;i<tbl_pl_list.length;i++) {
			for (var a=0;a<tbl_pl_list.length;a++) {
				var tempdoc = {};
				if ( moment(date+'T'+tbl_pl_list[a].Hour).isAfter(date+'T'+tbl_pl_list[i].Hour) == true) {
					tempdoc = tbl_pl_list[i];
					tbl_pl_list[i] = tbl_pl_list[a];
					tbl_pl_list[a] = tempdoc;
				} else if (moment(date+'T'+tbl_pl_list[a].Hour).isSame(date+'T'+tbl_pl_list[i].Hour) == true) {
					if (parseInt(tbl_pl_list[a].Order) > parseInt(tbl_pl_list[i].Order)) {
						tempdoc = tbl_pl_list[i];
						tbl_pl_list[i] = tbl_pl_list[a];
						tbl_pl_list[a] = tempdoc;
					}
				}
			}

			if (i+1 == tbl_pl_list.length) {
				var startHour = tbl_pl_list[0].Hour;
				var docHour = moment(date+'T'+tbl_pl_list[0].Hour);
				tbl_pl_list[0].Hour = currentHour;
				var diffMn = parseInt(timeHour.diff(docHour,"minutes"));
				//info("Difference of minutes:", diffMn);

				if (tbl_pl_list.length>1) {
					for (a=1;a<tbl_pl_list.length;a++) {
						var newHour;
						if (tbl_pl_list[a].Hour == startHour) {
							newHour = currentHour;
						} else {
							var docHour = moment(date+'T'+tbl_pl_list[a].Hour);
							if (diffMn >= 0)
								newHour = moment(docHour).add(diffMn, 'minutes').format("HH:mm");
							else {
								diff = diffMn * -1;
								newHour = moment(docHour).subtract(diff, 'minutes').format("HH:mm");
							}
							newHour =  ((newHour.indexOf (':') == 1) ? '0'+ newHour : newHour);
						}
						tbl_pl_list[a].Hour = newHour;

						if (a+1 == tbl_pl_list.length) {
							for (var b=0;b<tbl_pl_list.length;b++) {
								if (istime((date+'T'+tbl_pl_list[b].Hour), (date+'T'+hour))) {
									tbl_pl_list_start.push(tbl_pl_list[b]);
									//info(tbl_pl_list[b].Name + ' a ' + tbl_pl_list[b].Hour + ' ordre ' + tbl_pl_list[b].Order);
								} else {
									tbl_pl_list_next.push(tbl_pl_list[b]);
									//info(tbl_pl_list[b].Name + ' a ' + tbl_pl_list[b].Hour + ' ordre ' + tbl_pl_list[b].Order);
								}

								if (b+1 == tbl_pl_list.length) {
									if (tbl_pl_list_next.length > 0) {
										client.addNextItem (tbl_pl_list_next,0,client,client.addNextItem,function(){
											if (tbl_pl_list_start.length > 0)
												callback (tbl_pl_list_start,1,client,callback);
										});
									} else if (tbl_pl_list_start.length > 0) {
										callback (tbl_pl_list_start,1,client,callback);
									}
								}
							}
						}
					}
				} else {
					//info(tbl_pl_list[0].Name + ' a ' + tbl_pl_list[0].Hour + ' ordre ' + tbl_pl_list[0].Order);
					tbl_pl_list_start.push(tbl_pl_list[0]);
					if (istime((date+'T'+tbl_pl_list[0].Hour), (date+'T'+hour))) {
						callback (tbl_pl_list_start,1,client,callback);
					} else {
						client.addNextItem (tbl_pl_list_start,0,client,client.addNextItem);
					}
				}
			}
		}
	});
}



nedbClient.prototype.addNextItem = function(docs,pos,client,callback) {

	if (!callback) return;
	if (pos == docs.length) return;

	client.ScenarizdbnoCron.findOne({Program:docs[pos].Program, Name:docs[pos].Name}, function (err, docfound) {
			if (err){
				error("Enable to replace Scenariz Cron, error: ", err);
				return callback(docs,++pos,client,callback);
			}

			if (docfound) {
				// Doc found, just replace
				client.ScenarizdbnoCron.update({_id:docfound._id}, { $set:{	Client: docs[pos].Client,
																	Plugin: docs[pos].Plugin,
																	Order: docs[pos].Order,
																	Tempo: docs[pos].Tempo,
																	Speech: docs[pos].Speech,
																	Autodestroy: docs[pos].Autodestroy,
																	Exec: 'true',
																	Keys: docs[pos].Keys,
																	Fifo: docs[pos].Fifo,
																	Hour: docs[pos].Hour,
																	Days: docs[pos].Days
																}}, {}
					, function(err, numReplaced){
						if (numReplaced == 0 || err)
							error("Enable to replace Scenariz Cron, error: " + ((err) ? err : ''));
						callback(docs,++pos,client,callback);
				});
			} else {
				// New, create
				client.ScenarizdbnoCron.insert({
							Program: docs[pos].Program,
							Client: docs[pos].Client,
							Plugin: docs[pos].Plugin,
							Name: docs[pos].Name,
							Order: docs[pos].Order,
							Tempo: docs[pos].Tempo,
							Speech: docs[pos].Speech,
							Autodestroy: docs[pos].Autodestroy,
							Exec: 'true',
							Keys: docs[pos].Keys,
							Fifo: docs[pos].Fifo,
							Hour: docs[pos].Hour,
							Days: docs[pos].Days
					}, function(err, newDoc){
						if (!newDoc || err)
							error("Enable to create Scenariz Cron, error: " + ((err) ? err : ''));
						callback(docs,++pos,client,callback);
					});
			}
	});
}




// Search for modules to execute
nedbClient.prototype.dbcron = function (db, callback) {
	var client = this;
	// current date & hour
	var date = moment().format("YYYY-MM-DD"),
	    hour = moment().format("HH:mm");

	db.find({ Exec : "true" }, function (err, docs) {
		if (err){
				error("Enable to retrieve db items, error:", err);
				return;
		}
		var tbl_pl_list = [],
		    pending = docs.length;

		if (pending == 0)
			 return callback (tbl_pl_list);

		docs.forEach(function (doc) {
			doc.Hour =  ((doc.Hour.indexOf (':') == 1) ? '0'+ doc.Hour : doc.Hour);
			if (isday(doc.Days) && istime((date+'T'+doc.Hour), (date+'T'+hour))) {
				//if (client.debug == true) info("dbcron is time to:", doc.Name);

				if (doc.Client.toLowerCase() == 'currentroom')
					doc.Client = client.avatar_client;

				if (doc.Keys.toLowerCase().indexOf('currentroom') != -1)
					doc.Keys = doc.Keys.replace('currentRoom', client.avatar_client);

				tbl_pl_list.push(doc);

			}
			if (!--pending) {
				//if (client.debug == true && pending > 0) info("dbcron nb docs:", pending);
				callback (tbl_pl_list);
			}
		});
	});
}




// Save module in db
nedbClient.prototype.dbsave = function (program,plugin,name,order,tempo,exec,key,tts,autodestroy,mute,fifo,speechStartOnRecord,hour,days,clients,callback) {
	var client = this;
	client.Scenarizdb.findOne({Program:program, Name:name}, function (err, docfound) {
			if (err){
				error("Enable to retrieve Scenariz Cron, error:", err);
				return callback(false);
			}

			if (docfound) {
				// Doc found, just replace
				client.Scenarizdb.update({_id:docfound._id}, { $set:{
																	Client: clients,
																	Plugin: plugin,
																	Order: order,
																	Tempo: tempo,
																	Speech: tts,
																	Autodestroy: autodestroy,
																	Exec: exec.toLowerCase(),
																	Keys: key,
																	Fifo: fifo,
																	Hour: hour,
																	Days: days
																}}, {}
					, function(err, numReplaced){
						if (mute == 'true'){
							switch (numReplaced){
								case 0: //error(client.msg.err_localized('not_replaced') + ' ' + docfound.Name);
									return callback(false);
								case 1: //info(docfound.Name +  ' ' + client.msg.localized('cron_replaced'));
									return callback(true);
								default: //error(client.msg.err_localized('several_cron'));
									return callback(false);
							}
						} else {
							switch (numReplaced){
								case 0: Avatar.speak(client.msg.err_localized('not_replaced') + ' ' + docfound.Name, client.avatar_client, function() {
									return callback(false);
								});
								break;
								case 1:
										var dayAndTime = ' ';
										if (speechStartOnRecord == 'true')
											var dayAndTime = client.msg.localized('Pour_speech') + DayAndTimeOnSave(days, client) + client.msg.localized('A_speech') + hour;

										Avatar.speak(docfound.Name + ' ' + client.msg.localized('cron_replaced') + dayAndTime, client.avatar_client, function() {
											return callback(true);
										})
								break;
								default: Avatar.speak(client.msg.err_localized('several_cron'), client.avatar_client, function() {
									return callback(false);
								});
								break;
							}
						}
				});
			} else {
				// New, create
				client.Scenarizdb.insert({
							Program: program,
							Client: clients,
							Plugin: plugin,
							Name: name,
							Order:order,
							Tempo: tempo,
							Speech: tts,
							Autodestroy: autodestroy,
							Exec: exec.toLowerCase(),
							Keys: key,
							Fifo: fifo,
							Hour: hour,
							Days: days
					}, function(err, newDoc){
						if (!newDoc) {
							if (mute == 'true') {
								//error(newDoc.Name + ' ' + client.msg.err_localized('cron_not_saved'));
								return callback(false);
							} else {
								Avatar.speak(newDoc.Name + ' ' + client.msg.err_localized('cron_not_saved'), client.avatar_client, function() {
									return callback(false);
								});
							}
						} else {
							if (mute == 'true') {
								//info(newDoc.Name, client.msg.localized('cron_saved'));
								return callback(true);
							} else {
								var dayAndTime = ' ';
								if (speechStartOnRecord == 'true')
									var dayAndTime = DayAndTimeOnSave(days, client) + client.msg.localized('A_speech') + hour;

								Avatar.speak(newDoc.Name + ' ' + dayAndTime + ' ' + client.msg.localized('cron_saved'), client.avatar_client, function() {
									return callback(true);
								});
							}
						}
					});
			}
	});
}


var DayAndTimeOnSave = function (day, client) {

	if (day.substring(0,1) == '1') return client.msg.dayOfWeek(0);
	if (day.substring(1,2) == '1') return client.msg.dayOfWeek(1);
	if (day.substring(2,3) == '1') return client.msg.dayOfWeek(2);
	if (day.substring(3,4) == '1') return client.msg.dayOfWeek(3);
	if (day.substring(4,5) == '1') return client.msg.dayOfWeek(4);
	if (day.substring(5,6) == '1') return client.msg.dayOfWeek(5);
	if (day.substring(6) == '1') return client.msg.dayOfWeek(6);

}



// is it a good time to execute it ?
var istime = function (docDate, currentDate) {
	// 4 mn more -> cron starts all 5 minutes then
	// if the docDate is not exactly a multiple of 5 the algo add 4 minutes and check
	// If the cron is modified for example to each 1 minute then set the cron var to 0 (var cron = 0)
	// If the cron is modified for example to each 2 minutes then set the cron var to 1 (var cron = 1)
	var cron = 4,
        substractdate = moment(currentDate).add(cron, 'minutes').format("YYYY-MM-DDTHH:mm");

	if ((moment(substractdate).isAfter(docDate) == true && moment(currentDate).isBefore(docDate) == true ) || (moment(docDate).isSame(currentDate)== true ) || (moment(substractdate).isSame(docDate)== true ))
		return true;

	return false;
}


// is it a good day to execute it ?
var isday = function (days) {

	moment().weekday(1);
	if (days.substring(parseInt(moment().weekday()), (parseInt(moment().weekday()) + 1)) == '1')
		return true;

	return false;
}


var formatTask = function (task) {
	var keys={};
	keys.action = {};
	if (task != undefined) {
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
