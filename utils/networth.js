const axios = require('axios');
const { formatNumber } = require('./utils');

async function getProfiles(uuid) {
	try {
		// Initialize variables
		let bestNetworth = networth = unsoulboundNetworth = sbLvl = 0;
		let bestNetworthFormatted = "0";
		const profiles = { stats: { bestNetworth: "0" }, profiles: {} };
		const url = `https://soopy.dev/api/v2/player_skyblock/${uuid}?networth=true`;

		// API HTTP request
		const response = await axios.get(url);

		// Fetch profile IDs from request data
		const playerData = response.data;
		const profilesDict = playerData.data.profiles;
		const profileIds = Object.keys(profilesDict);

		// Loop through each profile and check networth and gamemode
		for (let profileId of profileIds) {
			let profileInfo = {};
		
			// Fetch gamemode if profile type isn't normal
			if ('gamemode' in playerData.data.profiles[profileId].stats) {
				profileInfo.gamemode = playerData.data.profiles[profileId].stats.gamemode.replace('island', 'stranded');
			} else {
				profileInfo.gamemode = 'normal';
			}
		
			// Fetch networth
			networth = playerData.data.profiles[profileId].members[uuid].nwDetailed.networth;
			unsoulboundNetworth = playerData.data.profiles[profileId].members[uuid].nwDetailed.unsoulboundNetworth;
		
			// Fetch sblvl
			sbLvl = playerData.data.profiles[profileId].members[uuid].sbLvl;
		
			// Update bestNetworth if current networth is greater
			if (networth > bestNetworth) {
				bestNetworth = networth; // Keep as integer
				bestUnsoulboundNetworth = unsoulboundNetworth; // Keep as integer
		
				// Optionally format here if you need to use the formatted string immediately
				bestNetworthFormatted = `[${Math.round(sbLvl)}] ${formatNumber(bestNetworth)}(${formatNumber(bestUnsoulboundNetworth)})`;
			}
		
			// Append information to all profiles dict
			profileInfo.networth = formatNumber(networth);
			profileInfo.unsoulboundNetworth = formatNumber(unsoulboundNetworth);
			profileInfo.sblvl = Math.round(sbLvl);
		
			profiles.profiles[profileId] = profileInfo;
		}

		// Update best networth
		profiles.stats.bestNetworthFormatted = bestNetworthFormatted;
		profiles.stats.bestNetworth = bestNetworth;
		return profiles;

	} catch (error) {
		console.error(`An error occurred while trying to get networth: ${error}`);
		return null;
	}
}

module.exports = getProfiles;
