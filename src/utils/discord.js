require('dotenv').config();
const axios = require('axios');

class DiscordUtil {
  // Sends a discord webhook message if any channels are configured here
  async sendWebhookMessage(message) {
    const webhookUrls = process.env.DISCORD_NOTIFICATION_WEBHOOKS?.split(',');
    if (webhookUrls) {
      let prefix = process.env.DISCORD_NOTIFICATION_PREFIX ? process.env.DISCORD_NOTIFICATION_PREFIX + '\n' : '';
      await Promise.all(
        webhookUrls.map(async (url) => {
          await axios.post(url, {
            // avatar_url: '',
            username: 'Subgraph Proxy',
            content: `${prefix}[${process.env.NODE_ENV}] - ${message}`
          });
        })
      );
    }
  }
}

module.exports = DiscordUtil;
