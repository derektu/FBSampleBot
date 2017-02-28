# Facebook Messenger Bot Sample

## Quick steps

- Read [https://developers.facebook.com/docs/messenger-platform/guides/quick-start](https://developers.facebook.com/docs/messenger-platform/guides/quick-start)
- 登入FB, 建立一個Facebook粉絲專頁以及App
    - 建立一個Page
    - 建立一個App, 類型為App for messenger, [操作畫面](https://cloud.githubusercontent.com/assets/522142/23288412/73310fe0-fa7e-11e6-8c12-be7ccb69d049.png)
    - 設定這個App會管理上面的Page(Create Page Token), [操作畫面](https://cloud.githubusercontent.com/assets/522142/23288413/73326c78-fa7e-11e6-984e-1d792ff8e405.png)
    - 在App Review for Messenger內勾選 pages_messaging 選項, [操作畫面](https://cloud.githubusercontent.com/assets/522142/23288414/73327330-fa7e-11e6-8888-4dd12a4f0a1e.png)

- 設定Bot
    - git tag: 1_basic_setup
    - config/default.json: 輸入appSecret, pageAccessToken, 任意一個validationToken
    - 安裝ngrok from [https://ngrok.com/](https://ngrok.com/), 我們需要一個可以對外的https的節點, 在開發階段可以使用ngrok來當這個gateway
    - 啟動ngrok, port傳入local web server的port一致

    ```
    $ ngrok http 5000
    ```

    - 啟動bot, 目前default會listen在5000 port

    ```
    $ npm start
    ```

    - 設定webhook, [操作畫面](https://cloud.githubusercontent.com/assets/522142/23288417/7338a020-fa7e-11e6-9213-f79cb49e86ea.png)
        - 把webhook的url設定為 https://.....ngrok.io/webhook, 這個啟動點可以從ngrok的畫面內看到, 注意要加上'webhook' suffix,
        - 設定validationToken: 這是一個任意的字串, 可是必須跟default.json內的一模一樣
    - 把webhook跟page連結在一起, [操作畫面](https://cloud.githubusercontent.com/assets/522142/23288415/73375670-fa7e-11e6-8b11-5997368c20de.png)
- 修改粉絲專頁, 在首頁新增傳送訊息按鈕, 就可以開始測試了, [操作畫面](https://cloud.githubusercontent.com/assets/522142/23288481/cef19ed0-fa7e-11e6-91f4-14a40a33fd88.png), alternatively也可以使用手機測試

## 功能

### 設定Greeting Text, 以及 GetStartedButton

- 請參考以下文件
    - https://developers.facebook.com/docs/messenger-platform/thread-settings/greeting-text
    - https://developers.facebook.com/docs/messenger-platform/thread-settings/get-started-button
- [設定後畫面](https://cloud.githubusercontent.com/assets/522142/23295219/4e97d980-faaa-11e6-8ceb-b8612088d035.png)
- 設定greeting text的code放在 /api/set_greetingtext 內
- 設定get started button的code放在 /api/set_getstartedbutton 內
- 使用者按了Get started之後會產生一個postback, 此時可以開始進行對談

### XQ帳號連結

- 使用Button template來提示使用者, 請參考以下文件
    - https://developers.facebook.com/docs/messenger-platform/send-api-reference/button-template
- Button內使用webview來串連XQ帳號登入畫面
- webview內可以運用messenger extension來跟messenger做溝通, 請參考以下文件
    - https://developers.facebook.com/docs/messenger-platform/messenger-extension
- 程式碼放在 send_LinkAccount內, 以及views/login.ejs內的javascript

### 設定Persistent menu

- 在輸入框旁邊放置一個按鈕, 擺置常用的功能, 請參考以下文件
    - https://developers.facebook.com/docs/messenger-platform/thread-settings/persistent-menu
- 設定persistent menu的code放在 /api/set_persistentmenu內
- [設定後畫面](https://cloud.githubusercontent.com/assets/522142/23386746/4b00e9d8-fd93-11e6-87a3-9ba4474422db.png)
- [開啟menu畫面](https://cloud.githubusercontent.com/assets/522142/23386749/4c5daa82-fd93-11e6-81c2-da23493a3521.PNG)

### 對話功能(QuickReply)

- 可以在訊息之後夾帶多個按鈕, 讓使用者可以快速挑選(不同於button template), 請參考以下文件
    - https://developers.facebook.com/docs/messenger-platform/send-api-reference/quick-replies
- 請參考 send_QueryStock 內的程式碼
- [QuickReply畫面](https://cloud.githubusercontent.com/assets/522142/23387122/8a097012-fd95-11e6-97e6-91024e1f6bf3.PNG)

### 對話功能(GenericTemplate)

- 可以傳送carousel式的訊息, 內含多個訊息, 每個訊息內可以有圖片, 文字, 按鈕等功能, 適合傳送新聞/報價類的資料, 請參考以下文件
    - https://developers.facebook.com/docs/messenger-platform/send-api-reference/generic-template
- 請參考 apiSendNews 內的程式碼, 注意Bot端需要紀錄使用者的psid, 使用這個id來主動push訊息
- [新聞畫面](https://cloud.githubusercontent.com/assets/522142/23387123/8b4cdd60-fd95-11e6-9784-f3bd42a11ebc.PNG)


