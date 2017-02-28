"use strict";

const
  _ = require('lodash'),
  bodyParser = require('body-parser'),
  config = require('config'),
  express = require('express'),
  morgan = require('morgan'),
  request = require('request-promise'),
  logger = require('./logger.js').getLogger('[app]'),
  Bot = require('messenger-bot');

const MSG = {
  GETSTARTED : 'GETSTARTED',
  ACCOUNTLINKED_YES : 'ACCOUNTLINKED.YES',
  ACCOUNTLINKED_NO : 'ACCOUNTLINKED.NO',
  SUBSCRIBE_NEWS : 'SUBSCRIBE_NEWS',
  SUBSCRIBE_NEWS_YES: 'SUBSCRIBE_NEWS.YES',
  SUBSCRIBE_NEWS_NO: 'SUBSCRIBE_NEWS.NO',
  QUERYSTOCK: 'QUERYSTOCK',
};

const STATE = {
  NONE : 'STATE.NONE',
  INTRO_ACCOUNT_LINKING : 'STATE.INTRO_ACCOUNT_LINKING',
  INTRO_NEWS_SUBSCRIPTION : 'STATE.INTRO_NEWS_SUBSCRIPTION',
  READY: 'STATE.READY'
};

class App {

  constructor() {
    // TODO: 真正的作法必須把user states存到external state service
    //
    this.states = {};
  }

  getUserState(psid) {
    let state = this.states[psid];
    if (!state) {
      state = STATE.NONE;
      this.states[psid] = state;
    }
    return state;
  }

  setUserState(psid, newstate) {
    this.states[psid] = newstate;
  }

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
    logger.error('Bot error:' + JSON.stringify(err));
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
      if (err)
        this.botError(err);
    });

  }

  // Handler for message & postback
  //
  botHandler(event, reply, actions) {

    let senderID = event.sender.id;

    logger.debug(`Received event:${JSON.stringify(event)}`);

    // Handle the following cases
    //  - user press a quick_reply (message.quick_reply.payload)
    //  - user enter some text (message.text)
    //  - user press a button to cause a postback (postback.payload)
    //
    let messageText = null;
    if (event.message) {
      if (event.message.quick_reply)
        messageText = event.message.quick_reply.payload;
      else if (event.message.text)
        messageText = event.message.text.toUpperCase();
    }
    else if (event.postback)
      messageText = event.postback.payload;

    let currentState = this.getUserState(senderID);

    if (messageText === MSG.GETSTARTED) {
      let newState = STATE.INTRO_ACCOUNT_LINKING;
      this.setUserState(senderID, newState);
      this.send_LinkAccount(reply, actions, senderID);
    }
    else if (messageText === MSG.ACCOUNTLINKED_YES || messageText === MSG.ACCOUNTLINKED_NO) {
      // TODO: 如果是在INTRO_ACCOUNT_LINKING的State時, 可以根據AccountLinking的狀態來決定下一個動作
      //
      let newState = currentState == STATE.INTRO_ACCOUNT_LINKING ? STATE.INTRO_NEWS_SUBSCRIPTION : STATE.READY;
      this.setUserState(senderID, newState);
      if (newState == STATE.INTRO_NEWS_SUBSCRIPTION) {
        this.send_NewsSubscription(reply, actions);
      }
      else {
        this.send_Ready(reply, actions);
      }
    }
    else if (messageText === MSG.SUBSCRIBE_NEWS) {
      this.send_NewsSubscription(reply, actions);
    }
    else if (messageText === MSG.SUBSCRIBE_NEWS_YES || messageText === MSG.SUBSCRIBE_NEWS_NO) {
      // TODO: update user's news subscription status
      //
      this.setUserState(senderID, STATE.READY);
      this.send_Ready(reply, actions);
    }
    else if (messageText === MSG.QUERYSTOCK) {
      this.send_QueryStock(reply, actions, senderID);
    }
    else if (messageText) {
      //
      let stocks = this.parseStockId(messageText);
      let msg = null;
      if (stocks.length == 1) {
        // match one stock
        //
        let stock = stocks[0];
        msg = {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: this.getStockStatus(stock),
              buttons:[
                {
                  type: "web_url",
                  url: this.SERVER_URL + '/stock?stockid=' + stock,
                  title: '更多資訊...',
                  messenger_extensions: true
                }
              ]
            }
          },
          quick_replies: this.getUserFavStocks(senderID)
        }
      }
      else if (stocks.length > 1) {
        // multiple matches
        //
        let buttons = _.map(stocks, (stock)=> {
          return {
            type: "postback",
            title: stock,
            payload: stock
          }
        });

        msg = {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: '請選擇以下股票',
              buttons: buttons
            }
          },
          quick_replies: this.getUserFavStocks(senderID)
        }
      }

      if (msg) {
        actions.setTyping(true);
        reply(msg, (err)=> {
          actions.setTyping(false);
          if (err)
            this.botError(err);
        });
      }
      else {
        this.send_Ready(reply, actions);
      }
    }
    else {
      this.send_Ready(reply, actions);
    }
  }

  // 詢問是否要登入
  //
  send_LinkAccount(reply, actions, psid) {
    let msg = {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "歡迎使用StockWiz. 如果你是XQ用戶的話, 請按底下的登入按鈕.",
          buttons:[
            {
              // for FB, 可以使用account_linking的功能(oauth的流程)
              // https://developers.facebook.com/docs/messenger-platform/account-linking
              // 可是因為LINE並沒有支援, 再加上我們可以控制login的流程, 所以就自己implement
              //
              // - 使用者的senderID (called psid), 就是我們要傳資料給user的id
              // - 放一個login頁面, 把psid帶進去(理論上應該要產生一個session來紀錄這個psid, 這裡簡單起見直接把psid傳在url上面)
              // - Messenger extensions (https://developers.facebook.com/docs/messenger-platform/messenger-extension)
              //    - Webview內的javascript可以透過Messenger extensions來跟Messenger溝通
              //
              type: "web_url",
              url: this.SERVER_URL + '/login?psid=' + psid,
              title: '登入',
              messenger_extensions: true
            },
            {
              type: "postback",
              title: "晚點再說",
              payload: MSG.ACCOUNTLINKED_NO
            }
          ]
        }
      }
    };

    actions.setTyping(true);
    reply(msg, (err) => {
      actions.setTyping(false);
      if (err)
        this.botError(err);
    });
  }

  // Step 2: 詢問是否要訂閱盤勢報導
  //
  send_NewsSubscription(reply, actions) {
    let msg = {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "StockWiz可以在每天開盤前跟收盤後傳送當日的盤勢分析新聞,如果有重大訊息的話也可以馬上通知你, 請問你要接收這些訊息嗎 ?",
          buttons:[
            {
              type: "postback",
              title: "YES",
              payload: MSG.SUBSCRIBE_NEWS_YES
            },
            {
              type: "postback",
              title: "晚點再說",
              payload: MSG.SUBSCRIBE_NEWS_NO
            }
          ]
        }
      }
    };

    actions.setTyping(true);
    reply(msg, (err) => {
      actions.setTyping(false);
      if (err)
        this.botError(err);
    });
  }

  send_Ready(reply, actions) {
    let msg = {
      text: "請輸入股號/股名來查詢即時資訊. 或是按輸入框左側的選項按鈕."
    };

    actions.setTyping(true);
    reply(msg, (err) => {
      actions.setTyping(false);
      if (err)
        this.botError(err);
    });
  }

  send_QueryStock(reply, actions, psid) {
    let msg = {
      text: "請輸入股號/股名來查詢即時資訊. 或是選擇以下常用的股票代碼.",
      quick_replies: this.getUserFavStocks(psid)
    };
    actions.setTyping(true);
    reply(msg, (err) => {
      actions.setTyping(false);
      if (err)
        this.botError(err);
    });
  }

  parseStockId(text) {
    text = text.toUpperCase();
    if (text == "TSE" || text == "TSE.TW")
      return ['TSE.TW'];
    else if (text == "FITX*1" || text == "FITX*1.TF")
      return ['FITX*1.TF'];
    else if (text == "2330" || text == "2330.TW")
      return ['2330.TW'];
    else if (text == "2317" || text == "2317.TW")
      return ['2317.TW'];
    else if (text == "2354" || text == "2354.TW")
      return ['2354.TW'];
    else if (text == "2881" || text == "2881.TW")
      return ['2881.TW'];
    else if (text == "23")
      return ['2330.TW', '2317.TW', '2354.TW'];
    else
      return [];
  }

  getStockStatus(stockid) {
    return `${stockid} 目前價格 100.0, +1(0.5%), 成交量500張`;
  }

  getUserFavStocks(senderId) {
    // TODO: 可以依照使用者回應不同的股票
    //
    let stocks = [
      {
        "content_type":"text",
        "title":"加權指數",
        "payload":"TSE.TW"
      },
      {
        "content_type":"text",
        "title":"台指",
        "payload":"FITX*1.TF"
      },
      {
        "content_type":"text",
        "title":"台積電",
        "payload":"2330.TW"
      },
      {
        "content_type":"text",
        "title":"鴻海",
        "payload":"2317.TW"
      },
      {
        "content_type":"text",
        "title":"富邦金",
        "payload":"2881.TW"
      }
    ];
    return stocks;
  }

  getAPIRouter() {
    let router = express.Router();

    router.get('/set_greeting', (req, res)=> { this.apiSetGreeting(req, res); });
    router.get('/set_getstartedbutton', (req, res)=> { this.apiSetGetStartedButton(req, res); });
    router.get('/set_persistentmenu', (req, res)=> { this.apiSetPersistentMenu(req, res); });
    router.get('/sendnews', (req, res)=> { this.apiSendNews(req, res); });
    router.post('/linkaccount', (req, res)=> { this.apiLinkAccount(req, res);});

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

    let call_to_actions = [{
      'payload': MSG.GETSTARTED
    }];

    this.bot.setGetStartedButton(call_to_actions, (err, body) => {
      if (err) {
        this.handleAPIError(req, res, err);
      }
      else {
        res.json(body);
      }
    });
  }

  apiSetPersistentMenu(req, res) {
    /* https://developers.facebook.com/docs/messenger-platform/thread-settings/persistent-menu */

    let call_to_actions = [
        {
          "type":"postback",
          "title":"查詢商品資訊",
          "payload":MSG.QUERYSTOCK
        },
        {
          "type":"postback",
          "title":"設定新聞訂閱",
          "payload": MSG.SUBSCRIBE_NEWS
        },
        {
          "type":"web_url",
          "title":"指令說明",
          "url": this.SERVER_URL + "/help.html"
        }
    ];

    this.bot.setPersistentMenu(call_to_actions, (err, body) => {
      if (err) {
        this.handleAPIError(req, res, err);
      }
      else {
        res.json(body);
      }
    });
  }

  apiSendNews(req, res) {
    // Send news to clients that subscribe news
    //
    let msg = {
      "attachment":{
        "type":"template",
        "payload": {
          "template_type": "generic",
          "elements": [
            {
              title: "比特幣3個月漲7成、創歷史新高，其實跟川普有關？",
              image_url: "https://www.moneydj.com/z/sjn/jpg/GetNewsRptjpg.djjpg?a=139419",
              buttons: [{
                type: "web_url",
                url: "https://m.moneydj.com/f1a.aspx?a=a67b5453-8f4d-4fa6-a098-24f66ad2db0b&c=MB010000",
                title: "詳細內容"
              }]
            },
            {
              title: "專家：美債殖利率三角形態盤整、破3%恐點燃新漲勢",
              image_url: "https://www.moneydj.com/z/sjn/jpg/GetNewsRptjpg.djjpg?a=178079",
              buttons: [{
                type: "web_url",
                url: "https://m.moneydj.com/f1a.aspx?a=fa1e6757-4e61-4015-a833-d26d5a0fd09e&c=MB010000",
                title: "詳細內容"
              }]
            },
            {
              title: "「東芝記憶體」來了！出售過半股權、降級二部成定局？",
              image_url: "https://www.moneydj.com/z/sjn/JPG/GetNewsRptJPG.djJPG?a=128202",
              buttons: [{
                type: "web_url",
                url: "https://m.moneydj.com/f1a.aspx?a=e20e121a-6bc2-45ed-96d7-bc878bfa29c7&c=MB010000",
                title: "詳細內容"
              }]
            }
          ]
        }
      }
    };
    _.each(this.states, (state, psid)=> {
      this.bot.sendMessage(psid, msg);
    });
    res.json(this.states);
  }

  apiLinkAccount(req, res) {
    let data = req.body;  // data.psid, data.xqid

    logger.info(data);

    let event = {
      postback: {
        payload: MSG.ACCOUNTLINKED_YES
      },
      sender: {
        id: data.psid
      },
      recipient: {
        id: ''      // TODO: this is our own page id
      },
      timestamp: '' // TODO: fill current time
    };

    // UGLY HACK: fake a postback event, 讓處理流程繞回去postback的地方
    //
    this.bot._handleEvent('postback', event);
    res.json({});
  }

  handleAPIError(req, res, err) {
    logger.error('Error request[' + req.url + '] Err=[' + JSON.stringify(err) + ']');
    res.status(500).send('Error occurred:' + JSON.stringify(err));
  }

  showLoginScreen(req, res) {
    let psid = req.query.psid;

    res.render(__dirname + '/views/login', { psid });
  }

  showStockScreen(req, res) {
    let stockid = req.query.stockid;

    res.render(__dirname + '/views/stock', { stockid });
  }

  getBotRouter(bot) {
    let router = express.Router();

    router.get('/', (req, res)=> {
      return bot._verify(req, res);
    });

    router.post('/', (req, res) => {
      bot._handleMessage(req.body)
      res.end(JSON.stringify({status: 'ok'}))
    });

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
    this.bot.on('message', (event, reply, actions) => { this.botHandler(event, reply, actions); });
    this.bot.on('postback', (event, reply, actions) => { this.botHandler(event, reply, actions); });

    let app = express();
    app.set('view engine', 'ejs');
    app.use(express.static('public'));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(morgan('common'));
    app.use('/api', this.getAPIRouter());
    app.use('/webhook', this.getBotRouter(this.bot));

    app.get('/login', (req, res) => {this.showLoginScreen(req, res);});
    app.get('/stock', (req, res) => {this.showStockScreen(req, res);});

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






