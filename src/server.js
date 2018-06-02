import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import botkit from 'botkit';
import dotenv from 'dotenv';
import yelp from 'yelp-fusion';

dotenv.config({ silent: true });

// initialize
const app = express();

// botkit controller
const controller = botkit.slackbot({
  debug: false,
});

// initialize slackbot
const slackbot = controller.spawn({
  token: process.env.SLACK_BOT_TOKEN,
  // this grabs the slack token we exported earlier
}).startRTM((err) => {
  // start the real time message client
  if (err) { throw new Error(err); }
});

// prepare webhook
// for now we won't use this but feel free to look up slack webhooks
controller.setupWebserver(process.env.PORT || 3001, (err, webserver) => {
  controller.createWebhookEndpoints(webserver, slackbot, () => {
    if (err) { throw new Error(err); }
  });
});

// example hello response
controller.hears(['hello', 'hi', 'howdy'], ['direct_message'], (bot, message) => {
  // bot.reply(message, 'Hello there!');
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, `Hello, ${res.user.name}!`);
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});

controller.hears(['help'], ['direct_mention'], (bot, message) => {
  bot.reply(message, 'If you type hungry, I can give you food recommendations.');
});

controller.on('direct_mention', (bot, message) => {
  bot.reply(message, 'sup');
});

controller.on('direct_message', (bot, message) => {
  bot.reply(message, 'yeet');
});

let userType = '';
let userLocation = '';

controller.hears(['hungry'], ['ambient', 'direct_mention', 'direct_message'], (bot, message) => {
  bot.startConversation(message, (err, convo) => {
    convo.ask('Would you like food recomendations near you?', [
      {
        pattern: bot.utterances.yes,
        callback(response, convo) {
          convo.say('Great!');
          askType(response, convo);
          convo.next();
        },
      },
      {
        pattern: bot.utterances.no,
        callback(response, convo) {
          convo.say('Perhaps later.');
          convo.next();
        },
      },
      {
        default: true,
        callback(response, convo) {
          convo.repeat();
          convo.next();
        },
      },
    ], {}, 'default');
  });
});

function askType(response, convo) {
  convo.ask('What type of food are you interested in?', (response, convo) => {
    userType = response.text;
    convo.say('Ok.');
    askWhere(response, convo);
    convo.next();
  });
}
function askWhere(response, convo) {
  convo.ask('Where are you?', (response, convo) => {
    userLocation = response.text;
    convo.say('Ok! One sec. Pulling up results.');
    results(userType, userLocation, convo);
    convo.next();
  });
}
function results(type, location, convo) {
  const client = yelp.client(process.env.YELP_CLIENT_SECRET);
  client.search({
    term: type,
    location,
  }).then((response) => {
    response.jsonBody.businesses.forEach((business) => {
      const attachments = {
        attachments: [
          {
            fallback: 'No results.',
            pretext: `rating: ${business.rating}`,
            title: business.name,
            title_link: business.url,
            image_url: business.image_url,
          },
        ],
      };
      convo.say(attachments);
      convo.next();
    });
  }).catch((e) => {
    convo.say('No results.');
    convo.next();
  });
}

controller.on('outgoing_webhook', (bot, message) => {
  bot.replyPublic(message, 'yeah yeah');
});

// enable/disable cross origin resource sharing if necessary
app.use(cors());

// enable/disable http request logging
app.use(morgan('dev'));

// enable only if you want templating
app.set('view engine', 'ejs');

// enable only if you want static assets from folder static
app.use(express.static('static'));

// this just allows us to render ejs from the ../app/views directory
app.set('views', path.join(__dirname, '../src/views'));

// enable json message body for posting data to API
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// default index route
app.get('/', (req, res) => {
  res.send('hi');
});

// START THE SERVER
// =============================================================================
// const port = process.env.PORT || 9090;
// app.listen(port);
//
// console.log(`listening on: ${port}`);
