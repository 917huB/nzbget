/*
 * This file is part of nzbget. See <https://nzbget.com>.
 *
 * Copyright (C) 2026 Denis <denis@nzbget.com>
 * 
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */


 var I18n = (new function($)
 {
	'use strict';
 
	var translations = {};
	var baseTranslations = {};
	var currentLocale = 'en'; 
	var availableLangs = [];
	var speedUnit = 'MB/s'; 
	var subscribers = [];

	// Polyfill for Intl.DateTimeFormat for very old browsers
	if (typeof window.Intl === 'undefined' || typeof window.Intl.DateTimeFormat === 'undefined') {
		window.Intl = window.Intl || {};
		window.Intl.DateTimeFormat = function(locale, options) {
			this.options = options || {};
			this.locale = locale || 'en-US';

			this.format = function(date) {
				if (!date || isNaN(date.getTime())) return '';

				var datePart = date.toLocaleDateString(this.locale, {
					year: this.options.year,
					month: this.options.month,
					day: this.options.day
				});

				if (this.options.hour && this.options.minute) {
					var h = date.getHours();
					var m = date.getMinutes();
					var s = date.getSeconds();
					var suffix = '';

					if (this.options.hour12 === true) {
						suffix = h >= 12 ? ' PM' : ' AM';
						h = h % 12;
						h = h ? h : 12; 
					}

					var timeStr = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
					
					if (this.options.second) {
						timeStr += ':' + (s < 10 ? '0' : '') + s;
					}
					
					return datePart + ', ' + timeStr + suffix;
				}
				
				return datePart;
			};
		};
	}

	this.init = function()
	{
		var self = this;
		// 1. Load available languages from source
		return $.ajax({
			url: 'locales.source.json',
			dataType: 'json',
			cache: true
		}).done(function(data)
		{
			if (data) {
				if (data['__LOCALES__']) {
					var locales = data['__LOCALES__'];
					for (var code in locales) {
						if (locales.hasOwnProperty(code)) {
							availableLangs.push({ code: code, name: locales[code] });
						}
					}
				}
				// Load default English messages from source
				for (var key in data) {
					if (key !== '__LOCALES__' && data.hasOwnProperty(key) && data[key] && data[key].message) {
						baseTranslations[key] = data[key].message;
						translations[key] = data[key].message;
					}
				}
			}

			// 2. Language Detection
			var savedLang = localStorage.getItem('Language');
			if (savedLang && self.isValidLang(savedLang))
			{
				currentLocale = savedLang;
			}
			else
			{
				// Try to get exact match from browser, or fallback to language match
				var browserLang = navigator.language || navigator.userLanguage; 
				if (browserLang)
				{
					if (self.isValidLang(browserLang)) {
						currentLocale = browserLang;
					} else {
						// Fallback to base language (e.g., "fr-CA" -> "fr")
						var shortLang = browserLang.split('-')[0].toLowerCase();
						for (var i = 0; i < availableLangs.length; i++) {
							if (availableLangs[i].code.toLowerCase() === shortLang) {
								currentLocale = availableLangs[i].code;
								break;
							}
						}
					}
				}
			}
 
			// 3. Unit Detection
			var savedSpeedUnit = localStorage.getItem('SpeedUnit');
			if (savedSpeedUnit)
			{
				speedUnit = savedSpeedUnit;
			}
		}).pipe(function() {
			// 4. Load Locale Files
			if (currentLocale !== 'en')
			{
				return self.loadLocale(currentLocale).fail(function() {
					currentLocale = 'en';
				});
			}
			return $.Deferred().resolve();
		}).fail(function()
		{
			console.error("Failed to load locales.source.json");
		});
	};

	this.loadLocale = function(langCode)
	{
		var url = '_locales/' + langCode + '/messages.json';
		return $.ajax({
			url: url,
			dataType: 'json',
			cache: true
		}).done(function(data)
		{
			// Merge new translations into existing ones
			for (var key in data) {
				if (data.hasOwnProperty(key)) {
					translations[key] = data[key];
				}
			}
		}).fail(function()
		{
			console.error("Failed to load " + url);
		});
	};
 
	this.isValidLang = function(code)
	{
		for (var i = 0; i < availableLangs.length; i++)
		{
			if (availableLangs[i].code === code) return true;
		}
		return false;
	};
 
	// Simple format function for $1, $2 placeholders
	this.format = function(format, args, translateFunc) {
		if (typeof format !== 'string') format = String(format);
		return format.replace(/\$(\d+)/g, function(match, number) {
			// $1 corresponds to args[0], $2 to args[1], etc.
			var val = args[parseInt(number) - 1];
			return typeof val != 'undefined' ? val : match;
		});
	};

	/**
	 * Extracts the translation text from a translation value.
	 * Translations can be either:
	 *   - A string: "translated text"
	 *   - An object with message property: { message: "translated text", description: "..." }
	 *
	 * @param {string|object} translation - The translation value from the translations object
	 * @returns {string} The translated text string
	 */
	function extractTranslationText(translation)
	{
		if (typeof translation === 'string')
		{
			return translation;
		}
		if (typeof translation === 'object' && translation !== null && translation.message)
		{
			return translation.message;
		}
		return null;
	}

	this.translate = function(key)
	{
		var transValue = translations && translations[key];
		if (!transValue && baseTranslations && baseTranslations[key]) {
			transValue = baseTranslations[key];
		}
		var extractedText = extractTranslationText(transValue);
		var text = extractedText !== null ? extractedText : key.replace(/^[a-z]+_/, '').replace(/_/g, ' ');
		
		if (arguments.length > 1) {
			var args = Array.prototype.slice.call(arguments, 1);
			return this.format(text, args, this.translate);
		}
		
		return text;
	};

	this.defaultValue = function(key, defaultText) {
		if (translations && translations.hasOwnProperty(key)) {
			return this.translate(key);
		}
		if (baseTranslations && baseTranslations.hasOwnProperty(key)) {
			return this.translate(key);
		}
		return defaultText;
	};
	
	this.translatePage = function(context)
	{
		var $context = context ? $(context) : $(document);

		var elements = $context.find('[data-i18n], [data-i18n-title], [data-i18n-placeholder], [data-i18n-value], [data-i18n-html]')
			.add($context.filter('[data-i18n], [data-i18n-title], [data-i18n-placeholder], [data-i18n-value], [data-i18n-html]'));

		elements.each(function()
		{
			var $this = $(this);
			
			// 1. Process HTML Content
			if (this.hasAttribute('data-i18n-html')) {
				var key = this.getAttribute('data-i18n-html');
				var translateArgs = [key];
				var i = 1;
				while (this.hasAttribute('data-i18n-html-arg-' + i)) {
					var arg = this.getAttribute('data-i18n-html-arg-' + i);
					translateArgs.push(Util.textToHtml(arg));
					i++;
				}
				var translated = I18n.translate.apply(I18n, translateArgs);
				if ($this.data('i18n-html-last') !== translated) {
					$this.data('i18n-html-last', translated);
					var oldHtml = $this.html();
					if (oldHtml !== translated) {
						$this.html(translated);
						I18n.translatePage($this.children());
					}
				}
			}

			// 2. Process Text Content
			if (this.hasAttribute('data-i18n')) {
				var key = this.getAttribute('data-i18n');
				var translateArgs = [key];
				var i = 1;
				while (this.hasAttribute('data-i18n-arg-' + i)) {
					translateArgs.push(this.getAttribute('data-i18n-arg-' + i));
					i++;
				}
				var translated = I18n.translate.apply(I18n, translateArgs);
				if ($this.data('i18n-last') !== translated && (translated !== key || $this.text() === "")) {
					$this.data('i18n-last', translated);
					
					// Safely update text without wiping child nodes
					var textNodes = $this.contents().filter(function() { return this.nodeType === 3 && this.nodeValue.trim() !== ''; });
					if (textNodes.length > 0) {
						textNodes.first()[0].nodeValue = translated;
					} else {
						var allTextNodes = $this.contents().filter(function() { return this.nodeType === 3; });
						if (allTextNodes.length > 0) {
							allTextNodes.last()[0].nodeValue = translated;
						} else {
							$this.prepend(document.createTextNode(translated));
						}
					}
				}
			}

			// 3. Process Title Attribute
			if (this.hasAttribute('data-i18n-title')) {
				var key = this.getAttribute('data-i18n-title');
				var translateArgs = [key];
				var i = 1;
				while (this.hasAttribute('data-i18n-title-arg-' + i)) {
					translateArgs.push(this.getAttribute('data-i18n-title-arg-' + i));
					i++;
				}
				var translated = I18n.translate.apply(I18n, translateArgs);
				if ($this.data('i18n-title-last') !== translated && (translated !== key || !$this.attr('title'))) {
					$this.data('i18n-title-last', translated);
					$this.attr('title', translated);
				}
			}

			// 4. Process Placeholder Attribute
			if (this.hasAttribute('data-i18n-placeholder')) {
				var key = this.getAttribute('data-i18n-placeholder');
				var translateArgs = [key];
				var i = 1;
				while (this.hasAttribute('data-i18n-placeholder-arg-' + i)) {
					translateArgs.push(this.getAttribute('data-i18n-placeholder-arg-' + i));
					i++;
				}
				var translated = I18n.translate.apply(I18n, translateArgs);
				if ($this.data('i18n-placeholder-last') !== translated && (translated !== key || !$this.attr('placeholder'))) {
					$this.data('i18n-placeholder-last', translated);
					$this.attr('placeholder', translated);
				}
			}

			// 5. Process Value Attribute
			if (this.hasAttribute('data-i18n-value')) {
				var key = this.getAttribute('data-i18n-value');
				var translateArgs = [key];
				var i = 1;
				while (this.hasAttribute('data-i18n-value-arg-' + i)) {
					translateArgs.push(this.getAttribute('data-i18n-value-arg-' + i));
					i++;
				}
				var translated = I18n.translate.apply(I18n, translateArgs);
				if ($this.data('i18n-value-last') !== translated && (translated !== key || !$this.val())) {
					$this.data('i18n-value-last', translated);
					$this.val(translated);
				}
			}
		});
	};
 
	this.getCurrentLang = function()
	{
		return currentLocale;
	};

	this.getLocale = function()
	{
		return currentLocale;
	};

	 this.getTimeFormatOptions = function ()
	 {
		return {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		};	 
	}
 
	this.getAvailableLangs = function()
	{
		return availableLangs;
	};
 
	this.subscribe = function(callback)
	{
		subscribers.push(callback);
	};
 
	this.unsubscribe = function(callback)
	{
		subscribers = subscribers.filter(function(s) { return s !== callback; });
	};
 
	this.setLanguage = function(localeCode)
	{
		var self = this;
		if (this.isValidLang(localeCode))
		{
			currentLocale = localeCode;
			localStorage.setItem('Language', localeCode);
			
			// Reset translations to English base
			translations = {};
			for (var key in baseTranslations) {
				if (baseTranslations.hasOwnProperty(key)) {
					translations[key] = baseTranslations[key];
				}
			}

			// Load new locale strings and apply without reload
			if (currentLocale !== 'en')
			{
				this.loadLocale(currentLocale).fail(function() {
					currentLocale = 'en';
					localeCode = 'en';
				}).always(function() {
					self._applyLanguageChange(localeCode);
				});
			}
			else
			{
				this._applyLanguageChange(localeCode);
			}
		}
	};
	
	this._applyLanguageChange = function(localeCode)
	{
		this.translatePage();
		
		// Update Language Switcher UI dynamically
		$('.lang-btn').removeClass('btn-active');
		$('.lang-btn[data-val="' + localeCode + '"]').addClass('btn-active');

		// Notify subscribers
		subscribers.forEach(function(callback) { callback(); });
	};
	
	this.getSpeedUnit = function()
	{
		return speedUnit;
	};

	this.setSpeedUnit = function(unit)
	{
		if (unit === 'MB/s' || unit === 'Mb/s') {
			speedUnit = unit;
			localStorage.setItem('SpeedUnit', speedUnit);
			
			// Update UI dynamically
			$('.unit-btn').removeClass('btn-active');
			$('.unit-btn[data-val="' + speedUnit + '"]').addClass('btn-active');
			
			// Redraw relevant components if available to reflect new units
			if (typeof Status !== 'undefined' && Status.redraw) Status.redraw();
			if (typeof SystemInfo !== 'undefined' && SystemInfo.redraw) SystemInfo.redraw();
			if (typeof Statistics !== 'undefined' && Statistics.redraw) Statistics.redraw();
			if (typeof StatDialog !== 'undefined' && StatDialog.redraw) StatDialog.redraw();
		}
	};

	this.toggleSpeedUnit = function()
	{
		this.setSpeedUnit((speedUnit === 'MB/s') ? 'Mb/s' : 'MB/s');
	};

	this.initPromise = this.init();

	$(document).ready(function() {
		I18n.initPromise.always(function() {
			I18n.translatePage();
		});
	});
}(jQuery));
