'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _nlp_compromise = require('nlp_compromise');
var _nlp_compromise2 = _interopRequireDefault(_nlp_compromise);
var _helpers = require('../../node_modules/ava-ia/lib/helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function (state) {

	return new Promise(function (resolve, reject) {

		for (var rule in Config.modules.scenariz.rules) {
			  var match = (0, _helpers.syntax)(state.sentence, Config.modules.scenariz.rules[rule]);
			  if (match) break;
		}

		if (match) {
			if (state.debug) info('ActionManageScenariz', 'action:', rule);
			setTimeout(function(){
				state.action = {
					module: 'scenariz',
					command: rule,
					value: Config.modules.scenariz.tts_action[rule] ? Config.modules.scenariz.tts_action[rule] : 'd\'accord',
					tts: true,
					no_end: true
				};

				resolve(state);
			}, 500);
		} else {
			setTimeout(function(){
				state.action = {
					value: 'je n\'ai pas pu trouver la règle',
					tts: true
				};
				resolve(state);
			}, 500);
		}

	});
};
