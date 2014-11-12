Hoodie ISBN Plugin
======================

> A hood.ie plug-in that does the oauth dance with goodreads. That's it for now.

## Usage

```js
hoodie.goodreads.getinfo({username: hoodie.account.username}).fail(function(){
    // fail case
  }).done(function(data){
    // data.goodreads_exists
  });
```
