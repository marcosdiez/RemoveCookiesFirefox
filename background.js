browser.browserAction.onClicked.addListener(() => {
	var gettingActiveTab = browser.tabs.query({active: true, currentWindow: true});
	gettingActiveTab.then(activeTabs, onError);

	function activeTabs(tabs) {
		var isLoggingEnabled = false;
		var deletedCookieCount = 0;
		var urlString = tabs[0].url;
		var storageCleanupStatus = "Success!";

		try {
			var url = new URL(urlString);

			if (url.hostname != '') {
				var domainSettings = getDomainNameFromLocalPublicSuffixList(url);
				if (domainSettings.isPublicSuffixDomain) {
					var gettingAllCookies = browser.cookies.getAll({});
					gettingAllCookies.then(cookies => deleteAllCookiesForDomain(domainSettings.url, cookies, url));

					// Remove storage here
					var removing = browser.browsingData.removeLocalStorage({hostnames: [hostname]});
					removing.then(onStorageRemoved, onStorageRemovalError).catch(onStorageDeletionError);
				}
				else {
					var gettingAllCookies = browser.cookies.getAll({});
					gettingAllCookies.then(cookies => deleteAllCookiesForDomainAndSubdomains(domainSettings.url, cookies, url));
				}
			} else {
				displayNumberOfErasedItems(0);
				// browser.notifications.create({
				// 	"type": "basic",
				// 	"iconUrl": browser.extension.getURL("icons/icon-96.png"),
				// 	"title": "Cookies not found",
				// 	"message": "Current URL has no host-name"
				// });
			}
		}
		catch(err) {
			writeMsg("error");
			browser.notifications.create({
				"type": "basic",
				"iconUrl": browser.extension.getURL("icons/icon-96.png"),
				"title": "An error has occurred",
				"message": err
			});
		}

		function deleteAllCookiesForDomainAndSubdomains(hostname, cookies, url) {
			var uniqueDomains = [hostname];
			for (cookie of cookies) {
				if(cookie.domain.indexOf(hostname) != -1) {
						addUnique(uniqueDomains, cookie.domain)
						try {
							var removing = browser.cookies.remove({url: getUrlFromDomain(cookie.domain, url, cookie.secure, cookie.path), name: cookie.name, storeId: cookie.storeId});
							removing.then(onCookieRemoved, onCookieRemovalError).catch(onCookieDeletionError);
							deletedCookieCount++;
						}
						catch(err) {
							if (isLoggingEnabled) {
								console.log('Caught exception:' + err);
							}
						}
				}
			}

			for (hName of uniqueDomains) {
					// Remove storage here too
					var removing = browser.browsingData.removeLocalStorage({hostnames: [hName]});
					removing.then(onStorageRemoved, onStorageRemovalError).catch(onStorageDeletionError);
					if (hName.substr(0, 1) === '.') {
						var removing = browser.browsingData.removeLocalStorage({hostnames: [hName.substr(1)]});
						removing.then(onStorageRemoved, onStorageRemovalError).catch(onStorageDeletionError);
					}
			}

			if (deletedCookieCount == 0) {
				showNoCookiesFoundNotification(hostname);
				return;
			}

			// Check if cookies still present
			var gettingAllCookies = browser.cookies.getAll({});
			gettingAllCookies.then(function(remainingCookies) {
				var undeletedCookiesCount = 0;
				for (cookie of remainingCookies) {
					if(cookie.domain.indexOf(hostname) != -1) {
						undeletedCookiesCount++;
					}
				}

				if (undeletedCookiesCount > 0) {
					showCookiesRemainingNotification(deletedCookieCount, hostname)
				} else {
					showCookiesDeletedNotification(deletedCookieCount, hostname)
				}
			});
		}

		function deleteAllCookiesForDomain(hostname, cookies, url) {
			for (cookie of cookies) {
				if(cookie.domain == hostname) {
					try {
						var removing = browser.cookies.remove({url: getUrlFromDomain(cookie.domain, url, cookie.secure, cookie.path), name: cookie.name, storeId: cookie.storeId});
						removing.then(onCookieRemoved, onCookieRemovalError).catch(onCookieDeletionError);
						deletedCookieCount++;
					}
					catch(err) {
						if (isLoggingEnabled) {
							console.log('Caught exception:' + err);
						}
					}
				}
			}

			if (deletedCookieCount == 0) {
				showNoCookiesFoundNotification(hostname);
				return;
			}

			// Check if cookies still present
			var gettingAllCookies = browser.cookies.getAll({});
			gettingAllCookies.then(function(remainingCookies) {
				var undeletedCookiesCount = 0;
				for (cookie of remainingCookies) {
					if(cookie.domain == hostname) {
						undeletedCookiesCount++;
					}
				}

				if (undeletedCookiesCount > 0) {
					showCookiesRemainingNotification(deletedCookieCount, hostname)
				} else {
					showCookiesDeletedNotification(deletedCookieCount, hostname)
				}
			});
		}

		function onCookieRemoved(cookie) {
			if (isLoggingEnabled) {
				console.log('Cookie REMOVED:' + cookie);
			}
		}

		function onStorageRemoved() {
			if (isLoggingEnabled) {
				console.log('Storage REMOVED');
			}
		}

		function onCookieRemovalError(error) {
			if (isLoggingEnabled) {
				console.log('Cookie removal ERROR:' + error);
			}
		}

		function onStorageRemovalError(error) {
			if (isLoggingEnabled) {
				console.log('Storage removal ERROR:' + error);
			}
			storageCleanupStatus = 'Failure!'
		}

		function onCookieDeletionError(error) {
			if (isLoggingEnabled) {
				console.log('Cookie deletion ERROR:' + error);
			}
		}

		function onStorageDeletionError(error) {
			if (isLoggingEnabled) {
				console.log('Storage deletion ERROR:' + error);
			}
			storageCleanupStatus = 'Failure!'
		}

		function getUrlFromDomain(domain, url, isSecure, path) {
			var retUrl = "";
			if (domain.charAt(0) == '.') {
				retUrl = domain.substring(1);
			} else {
				retUrl = domain;
			}

			if (path != '/')
			{
				retUrl += path;
			}

			var retval = isSecure ? 'https' + '://' + retUrl : 'http' + '://' + retUrl;

			return retval;
		}


		function displayNumberOfErasedItems(count){
			writeMsg(`-${count.toString()}`);
		}
		function writeMsg(msg){
			clearTimeout();
			browser.browserAction.setBadgeText({text: msg});
			setTimeout( () => {
				browser.browserAction.setBadgeText({text: ''});
			}, 2500);
		}


		function showCookiesDeletedNotification(count, domainName) {
			displayNumberOfErasedItems(count);
			// browser.notifications.create({
			// 	"type": "basic",
			// 	"iconUrl": browser.extension.getURL("icons/icon-96.png"),
			// 	"title": "Cookies removed",
			// 	"message": "All cookies for " + domainName + " were successfully removed. Number of Cookies removed: " + count + ". Storage cleanup status: " + storageCleanupStatus
			// });
		}

		function showCookiesRemainingNotification(count, domainName) {
			displayNumberOfErasedItems(count);
			// browser.notifications.create({
			// 	"type": "basic",
			// 	"iconUrl": browser.extension.getURL("icons/icon-96.png"),
			// 	"title": "Cookies remaining",
			// 	"message": "New cookies for " + domainName + " were found after clean-up operation was completed. Number of Cookies removed: " + count + ". Storage cleanup status: " + storageCleanupStatus
			// });
		}

		function showNoCookiesFoundNotification(domainName) {
			displayNumberOfErasedItems(0);
			// browser.notifications.create({
			// 	"type": "basic",
			// 	"iconUrl": browser.extension.getURL("icons/icon-96.png"),
			// 	"title": "No cookies found",
			// 	"message": "No cookies were found for " + domainName + ". Storage cleanup status: " + storageCleanupStatus
			// });
		}
	}

	function onError() {
		browser.notifications.create({
			"type": "basic",
			"iconUrl": browser.extension.getURL("icons/icon-96.png"),
			"title": "Unable to retrieve current tab",
			"message": "Plug-in was unable to access currently active tab"
		});
	}
});

function getDomainNameFromLocalPublicSuffixList(url) {
	var domainSections = url.hostname.split('.');

	var indexNotInPublicSuffix = -1
	var isPublicSuffixDomain = true;
	var domainNameTmp = new Array();

	for (var i = domainSections.length - 1; i > -1; i--) {
		domainNameTmp.unshift(domainSections[i]);
		if (publicSuffixArray.indexOf(domainNameTmp.join('.')) == -1) {
			isPublicSuffixDomain = false;
			if (i == domainSections.length - 1) {
				break;
			} else {
				indexNotInPublicSuffix = i;
				break;
			}
		}
	}

	if (indexNotInPublicSuffix == -1) {
		return {url: url.hostname, isPublicSuffixDomain: isPublicSuffixDomain};
	} else {
		domainSections.splice(0, indexNotInPublicSuffix);
		return {url: domainSections.join('.'), isPublicSuffixDomain: isPublicSuffixDomain};
	}
}

function addUnique(arr, str) {
	if (arr.indexOf(str) === -1) {
		arr.push(str);
	}
}