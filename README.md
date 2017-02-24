# Facebook Messenger Bot Sample

## Quick steps

- Read [https://developers.facebook.com/docs/messenger-platform/guides/quick-start](https://developers.facebook.com/docs/messenger-platform/guides/quick-start)
- 登入FB, 建立一個Facebook粉絲專頁以及App
    - 建立一個Page
    - 建立一個App, 類型為App for messenger, 請參考(01_CreateFacebookApp.png)
    - 設定這個App會管理上面的Page(Create Page Token), 請參考(02_CreatePageToken.png)
    - 在App Review for Messenger內勾選 pages_messaging 選項, 請參考(03_EnableSendReceiveAPI.png)

- 設定Bot
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
    - 設定webhook, 請參考(04_SetupWebhook.png)
        - 把webhook的url設定為 https://.....ngrok.io/webhook, 這個啟動點可以從ngrok的畫面內看到, 注意要加上'webhook' suffix,
        - 設定validationToken: 這是一個任意的字串, 可是必須跟default.json內的一模一樣
    - 把webhook跟page連結在一起, 請參考(05_SubscribeWebhookToPage.png)
- 修改粉絲專頁, 在首頁新增傳送訊息按鈕, 就可以開始測試了, 請參考 (06_AddSendMessageButton.png), alternatively也可以使用手機測試

