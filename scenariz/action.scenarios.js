'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _nlp_compromise = require('nlp_compromise');
var _nlp_compromise2 = _interopRequireDefault(_nlp_compromise);
var _helpers = require('../../node_modules/ava-ia/lib/helpers');
var _ = require('underscore');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function (state) {

	return new Promise(function (resolve, reject) {

		for (var rule in Config.modules.scenariz.scenarios) {
			  var match = (0, _helpers.syntax)(state.sentence, Config.modules.scenariz.scenarios[rule]);
			  if (match) break;
		}

		var when = _determineWhen (state.sentence);

		if (match) {
			if (state.debug) info('ActionScenariz', 'action:', rule, 'when:', when ? when.toString() : 'now');
			setTimeout(function(){
				state.action = {
					module: 'scenariz',
					command: 'execCron',
					program: rule,
					value: when ? 'je programme le scénario ' + rule + ' dans ' + when + ' minutes.' : 'tout de suite',
					tts: true
				};
				if (when) state.action.timeout = when;

				resolve(state);
			}, 500);
		} else {
			setTimeout(function(){
				state.action = {
					value: 'je n\'ai pas pu trouver la règle du scénario',
					tts: true
				};
				resolve(state);
			}, 500);
		}

	});
};


function _determineWhen(sentence) {

	var time;
	var terms = _nlp_compromise2.default.text(sentence).sentences[0].terms;
	terms.map(function (term, index) {
		if (term.tag === 'Date') {

			var when = (terms[index].text).split(' ');

			if (!_.isNaN(parseInt(when[0]))) {
				time = parseInt(when[0]);
			} else {
				var period = word2Num(when[0].toLowerCase());
				if (period > 0) {
					time = period;
				}
			}

			if (time && when[1].toLowerCase().indexOf('hour') != -1) time = time * 60;

		} else if (term.tag === 'Value') {
			var when = (terms[index].text).split('h');

			if (!_.isNaN(parseInt(when[0]))) {
				time = parseInt(when[0]) * 60;
				if (when[1]) time += parseInt(when[1]);
			}
		}
	});

	return time;

}


function word2Num (time) {

	var Small = {
		'zero': 0, 'one': 1,'two': 2,'three': 3,'four': 4,'five': 5,'six': 6,'seven': 7,'eight': 8,'nine': 9,
		'ten': 10,'eleven': 11,'twelve': 12,'thirteen': 13,'fourteen': 14,'fifteen': 15,'sixteen': 16,'seventeen': 17,'eighteen': 18,'nineteen': 19,
		'twenty': 20,'thirty': 30,'forty': 40,'fifty': 50,'sixty': 60,'seventy': 70,'eighty': 80,'ninety': 90
	};

	var a, n, g;

	function text2num(s) {
		a = s.toString().split(/[\s-]+/);
		n = 0;
		g = 0;
		a.forEach(feach);
		return n + g;
	}

	function feach(w) {
		var x = Small[w];
		if (x != null) {
			g = g + x;
		}
		else if (w == "hundred") {
			g = g * 100;
		}
	}

	return text2num(time);

}
