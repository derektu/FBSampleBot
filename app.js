"use strict";

const
  bodyParser = require('body-parser'),
  config = require('config'),
  express = require('express'),
  morgan = require('morgan'),
  request = require('request-promise'),
  logger = require('./logger.js').getLogger('[app]'),
  Bot = require('messenger-bot');

const MSG = {
  GETSTARTED : 'GETSTARTED'
};


class App {

  loadSetting() {
    // Retrieve setting from either environment variables or from config
    //
    this.APP_SECRET = (process.env.MESSENGER_APP_SECRET) ?
      process.env.MESSENGER_APP_SECRET :
      config.get('appSecret');

    this.VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
      (process.env.MESSENGER_VALIDATION_TOKEN) :
      config.get('validationToken');

    this.PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
      (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
      config.get('pageAccessToken');

    this.SERVER_URL = (process.env.SERVER_URL) ?
      (process.env.SERVER_URL) :
      config.get('serverURL');
  }

  botError(err) {
    logger.error(err);
  }

  botMessage(event, reply, actions) {

    let senderID = event.sender.id;
    let recipientID = event.recipient.id;
    let timeOfMessage = event.timestamp;
    let message = event.message;

    logger.debug(`Received message from user:${senderID} with message:${JSON.stringify(message)} at time:${timeOfMessage}`);

    let msg = {text: '<Echo>' + message.text};

    actions.setTyping(true);
    reply(msg, (err)=> {
      actions.setTyping(false);
      if (err) throw err;
    });

  }

  botPostback(event, reply, actions) {
    let senderID = event.sender.id;
    let recipientID = event.recipient.id;
    let timeOfPostback = event.timestamp;
    // The 'payload' param is a developer-defined field which is set in a postback
    // button for Structured Messages.
    let payload = event.postback.payload;

    logger.debug(`Received postback for user:${senderID} with payload:${payload} at time:${timeOfPostback}`);

    if (payload === MSG.GETSTARTED) {
      logger.debug(`Get started`);
      // user第一次按Get Started Button, respond with first message, track session(senderID), etc.
      //
      let msg = {
        text: '歡迎使用StockWiz. 如果你是XQ用戶的話, 請按底下的登入按鈕.'
      };

      reply(msg, (err) => {
        if (err) throw err;
      });
    }
    else {
      // TODO
      let msg = { text: 'Postback received'};

      actions.setTyping(true);
      reply(msg, (err)=> {
        actions.setTyping(false);
        if (err) throw err;
      });
    }
  }

  getAPIRouter() {
    let router = express.Router();

    router.get('/set_greeting', (req, res)=> { this.apiSetGreeting(req, res); });
    router.get('/set_getstartedbutton', (req, res)=> { this.apiSetGetStartedButton(req, res); });

    return router;
  }

  apiSetGreeting(req, res) {
    /* https://developers.facebook.com/docs/messenger-platform/thread-settings/greeting-text */
    request({
      method: 'POST',
      uri: 'https://graph.facebook.com/v2.6/me/thread_settings',
      qs: { 'access_token': this.PAGE_ACCESS_TOKEN },
      json: {
        "setting_type":"greeting",
        "greeting":{
          "text": "{{user_full_name}} 你好，歡迎使用StockWiz。 請按底下的開始按鈕."
        }
      }
    })
    .then(body => {
      if (body.error) throw body.error;
      res.json(body);
    })
    .catch(err => {
      this.handleAPIError(req, res, err);
    })
  }

  apiSetGetStartedButton(req, res) {
    /* https://developers.facebook.com/docs/messenger-platform/thread-settings/get-started-button */

    let payload = [{
      'payload': MSG.GETSTARTED
    }];

    this.bot.setGetStartedButton(payload, (err, body) => {
      if (err) {
        this.handleAPIError(req, res, err);
      }
      else {
        res.json(body);
      }
    });
  }

  handleAPIError(req, res, err) {
    logger.error('Error request[' + req.url + '] Err=[' + JSON.stringify(err) + ']');
    res.status(500).send('Error occurred:' + JSON.stringify(err));
  }

  getBotRouter(bot) {
    let router = express.Router();

    router.get('/', (req, res)=> {
      return bot._verify(req, res);
    })

    router.post('/', (req, res) => {
      bot._handleMessage(req.body)
      res.end(JSON.stringify({status: 'ok'}))
    })

    return router;
  }

  start(port) {
    this.loadSetting();
    if (!this.APP_SECRET || !this.VALIDATION_TOKEN || !this.PAGE_ACCESS_TOKEN || !this.SERVER_URL)
      throw "Missing config values";

    this.bot = new Bot({
      token: this.PAGE_ACCESS_TOKEN,
      verify: this.VALIDATION_TOKEN,
      app_secret: this.APP_SECRET
    });

    this.bot.on('error', (err) => { this.botError(err); });
    this.bot.on('message', (event, reply, actions) => { this.botMessage(event, reply, actions); });
    this.bot.on('postback', (event, reply, actions) => { this.botPostback(event, reply, actions); });

    let app = express();
    app.set('view engine', 'ejs');
    app.use(express.static('public'));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(morgan('common'));
    app.use('/api', this.getAPIRouter());
    app.use('/webhook', this.getBotRouter(this.bot));

    // default error handler
    //
    app.use((err, req, res, next) => {
      logger.error('Error request[' + req.url + '] Err=[' + err.toString() + ']');
      res.status(500).send('Error occurred:' + err.toString());
    });

    app.listen(port);
  }
}

let app = new App();
let port = process.env.PORT || 5000;
try {
  app.start(port);
  logger.info('Bot started at port:' + port);
}
catch(exception) {
  logger.error('Exception:' + exception);
  process.exit(1);
}






