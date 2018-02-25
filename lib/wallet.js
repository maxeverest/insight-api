'use strict';

var config_virtualwallet = require('../config/config_virwallet');
var config_virtualwallet_exchange = require('../config/config_virwallet_exchange');

var bitcore = require('bitcore-lib'); //@ntr upgrade Insight2-3
var _ = bitcore.deps._;
var $ = bitcore.util.preconditions;
var common = require('./common');

var TxController = require('./transactions');
var AddressController = require('./addresses');

var unityCoin = 1e-8;
var flashCoin = 1e10; // 10,000,000, satoshis --> 10,000,000,000 satoshis
var defaultFee = 10000;
var defaultWebWalletFee = 0.001*flashCoin;

function WalletController(node) {
  this.node = node;
  this.txController = new TxController(node);
  this.AddressController = new AddressController(node);
}

/**
* Creates a new wallet and returns an instance of type {privateKey:String, publicKey: String, publicAddress: String}
* */
WalletController.prototype.createWallet = function(req, res) {
	var network = bitcore.Networks[this.node.network];

	var privateKey = new bitcore.PrivateKey();
	var publicKey = privateKey.toPublicKey();
    var publicAddress = publicKey.toAddress(network);

	var obj = {
		privateKey: privateKey.toString(),
		publicKey: publicKey.toString(),
		publicAddress: publicAddress.toString(),
	};

	res.jsonp(obj);
};

/**
 * Gets balance, including confirmed balance and unconfirmed balance of specified address.
 * */
WalletController.prototype.getBalance = function (req, res) {
	var addr = req.params.addr;
	var options = {
		noTxList: parseInt(req.query.noTxList)
	};

	this.AddressController.getAddressSummary(addr, options, function(err, data) {
		if(err) {
		return common.handleErrors(err, res);
		}
		res.jsonp({ balance: data.balance, ubalance: data.unconfirmedBalance});
	});
};

/**
 * Executes transaction.
 * @from String The from address.
 * @to String The to address.
 * @amount Number The amount need to be transfered.
 * @pkey String The private key.
 * */
WalletController.prototype.sendTx = function (req, res) {

	var fromAddrString = req.body.from_public_address,
		toAddrString = req.body.to_public_address,
		amount = req.body.amount,
		privateKey = req.body.private_key;

	var err = common.validateNullArguments({ from: fromAddrString, to: toAddrString, amount: amount, pkey: privateKey });
	if (err) return common.handleErrors(err, res);

	try {
      amount = Math.round(parseFloat(amount) * flashCoin);
      var toAddr = new bitcore.Address(toAddrString);
      var fromAddr = new bitcore.Address(fromAddrString);
    } catch(e) {
      return common.handleErrors({
        message: 'Invalid address: ' + e.message,
        code: 1
      }, res);
    }

	var self = this;
	this.node.getUnspentOutputs(fromAddrString, true, function(err, utxos) {
		if(err && err instanceof self.node.errors.NoOutputs) {
			utxos = [];
		} else if(err) {
			return common.handleErrors(err, res);
		}

		var total = 0;
    var suggest_utxos = [];
		utxos.forEach(function (tx) {
      if (tx.confirmations) {
        if (total < (amount + defaultFee)) suggest_utxos.push(tx);
        total += tx.satoshis;
      }
		});

		if (total < (amount + defaultFee)) {
			return common.handleErrors({ message: "Not enough money (or fee is too small)", code: 1 }, res);
		}

		var transaction = new bitcore.Transaction()
		.from(suggest_utxos)          // Feed information about what unspent outputs one can use
		.to(toAddrString, amount)  // Add an output with the given amount of satoshis
		.change(fromAddrString)      // Sets up a change address where the rest of the funds will go
		.sign(privateKey)     // Signs all the inputs it can

		console.log('transaction.serialize()', transaction.serialize(true));

		self.node.sendTransaction(transaction.serialize(), function(err, txid) {
			if(err) {
			  // TODO handle specific errors
			  return common.handleErrors(err, res);
			}

			res.json({'txid': txid});
		});
	});
};

/**
 * Executes sendtransaction by using Virtual Wallet.
 * @to String: The to address.
 * @amount: Number The amount need to be transfered.
 * @message: Note for sending transaction.
 * */
WalletController.prototype.sendToAddress = function (req, res) {
	var toAddrString = req.body.to_public_address,
		amount = req.body.amount,
		message = req.body.msg;
	amount = 2;
	var fromAddrString = config_virtualwallet.data.publicAddress;
	var privateKey = config_virtualwallet.data.privateKey;

	var err = common.validateNullArguments({ from: fromAddrString, to: toAddrString, amount: amount, pkey: privateKey });
	if (err) return common.handleErrors(err, res);

	try {
      amount = Math.round(parseFloat(amount) * flashCoin);
      var toAddr = new bitcore.Address(toAddrString);
      var fromAddr = new bitcore.Address(fromAddrString);
    } catch(e) {
      return common.handleErrors({
        message: 'Invalid address: ' + e.message,
        code: 1
      }, res);
    }

	var self = this;
	this.node.getUnspentOutputs(fromAddrString, true, function(err, utxos) {
		if(err && err instanceof self.node.errors.NoOutputs) {
			utxos = [];
		} else if(err) {
			return common.handleErrors(err, res);
		}

		var total = 0;
    var suggest_utxos = [];
		utxos.forEach(function (tx) {
			if (tx.confirmations) {
        if (total < (amount + defaultFee)) suggest_utxos.push(tx);
        total += tx.satoshis;
      }
		});

		if (total < (amount + defaultFee)) {
			return common.handleErrors({ message: "Not enough money (or fee is too small)", code: 1 }, res);
		}

		var transaction = new bitcore.Transaction()
		.from(suggest_utxos)          // Feed information about what unspent outputs one can use
		.to(toAddrString, amount)  // Add an output with the given amount of satoshis
		.change(fromAddrString)      // Sets up a change address where the rest of the funds will go
		.sign(privateKey)     // Signs all the inputs it can

		console.log('transaction.serialize()', transaction.serialize(true));

		self.node.sendTransaction(transaction.serialize(), function(err, txid) {
			if(err) {
			  // TODO handle specific errors
			  return common.handleErrors(err, res);
			}

			res.json({'txid': txid});
		});
	});
};

/**
 * Executes sendtransaction by using Virtual Wallet.
 * @to String: The to address.
 * @amount: Number The amount need to be transfered.
 * @message: Note for sending transaction.
 * */
WalletController.prototype.sendToAddressExchange = function (req, res) {
	var toAddrString = req.body.to_public_address,
		amount = req.body.amount,
		message = req.body.msg;

	var fromAddrString = config_virtualwallet_exchange.data.publicAddress;
	var privateKey = config_virtualwallet_exchange.data.privateKey;

	var err = common.validateNullArguments({ from: fromAddrString, to: toAddrString, amount: amount, pkey: privateKey });
	if (err) return common.handleErrors(err, res);

	try {
      amount = Math.round(parseFloat(amount) * flashCoin);
      var toAddr = new bitcore.Address(toAddrString);
      var fromAddr = new bitcore.Address(fromAddrString);
    } catch(e) {
      return common.handleErrors({
        message: 'Invalid address: ' + e.message,
        code: 1
      }, res);
    }

	var self = this;
	this.node.getUnspentOutputs(fromAddrString, true, function(err, utxos) {
		if(err && err instanceof self.node.errors.NoOutputs) {
			utxos = [];
		} else if(err) {
			return common.handleErrors(err, res);
		}

		var total = 0;
    var suggest_utxos = [];
		utxos.forEach(function (tx) {
			if (tx.confirmations) {
        if (total < (amount + defaultFee)) suggest_utxos.push(tx);
        total += tx.satoshis;
      }
		});

		if (total < (amount + defaultFee)) {
			return common.handleErrors({ message: "Not enough money (or fee is too small)", code: 1 }, res);
		}

		var transaction = new bitcore.Transaction()
		.from(suggest_utxos)          // Feed information about what unspent outputs one can use
		.to(toAddrString, amount)  // Add an output with the given amount of satoshis
		.change(fromAddrString)      // Sets up a change address where the rest of the funds will go
		.sign(privateKey)     // Signs all the inputs it can

		console.log('transaction.serialize()', transaction.serialize(true));

		self.node.sendTransaction(transaction.serialize(), function(err, txid) {
			if(err) {
			  // TODO handle specific errors
			  return common.handleErrors(err, res);
			}

			res.json({'txid': txid});
		});
	});
};


/**
 * Gets a transaction in details.
 * @txid String The specified transction id.
 */
WalletController.prototype.getTxInfo = function (req, res) {
	var txid = req.params.txid;
	var err = common.validateNullArguments({ txid: txid });
	if (err) return common.handleErrors(err, res);

	var self = this;
	this.node.getTransactionWithBlockInfo(txid, true, function(err, transaction) {
		if (err && err instanceof self.node.errors.Transaction.NotFound) {
			return common.handleErrors(null, res);
		} else if(err) {
			return common.handleErrors(err, res);
		}
		transaction.populateInputs(self.node.services.db, [], function(err) {
			if(err) {
				return res.send({error: err.toString()});
			}
			self.txController.transformTransaction(transaction, function(err, transformedTransaction) {
				if (err) {
					return common.handleErrors(err, res);
				}
				res.jsonp(transformedTransaction);
			});
		});
	});
};

WalletController.prototype.createUnsigedRawTransaction = function (req, res) {

	var fromAddrString = req.body.from_public_address,
		toAddrString = req.body.to_public_address,
		amount = req.body.amount;

	var err = common.validateNullArguments({ from: fromAddrString, to: toAddrString, amount: amount });
	if (err) return common.handleErrors(err, res);

	try {
      amount = Math.round(parseFloat(amount) * flashCoin);
      var toAddr = new bitcore.Address(toAddrString);
      var fromAddr = new bitcore.Address(fromAddrString);
    } catch(e) {
      return common.handleErrors({
        message: 'Invalid address: ' + e.message,
        code: 1
      }, res);
    }

	var self = this;
	this.node.getUnspentOutputs(fromAddrString, true, function(err, utxos) {
		if(err && err instanceof self.node.errors.NoOutputs) {
			utxos = [];
		} else if(err) {
			return common.handleErrors(err, res);
		}

		var total = 0;
    var suggest_utxos = [];
		utxos.forEach(function (tx) {
      if (tx.confirmations) {
        if (total < (amount + defaultWebWalletFee)) suggest_utxos.push(tx);
        total += tx.satoshis;
      }
		});

		if (total < (amount + defaultWebWalletFee)) {
			return common.handleErrors({ message: "Not enough money (or fee is too small)", code: 1 }, res);
		}

		var transaction = new bitcore.Transaction()
		.from(suggest_utxos)          // Feed information about what unspent outputs one can use
		.to(toAddrString, amount)  // Add an output with the given amount of satoshis
		.change(fromAddrString)      // Sets up a change address where the rest of the funds will go
		.fee(defaultWebWalletFee)

		var rawtx = transaction.serialize(true);
		var txid = transaction._getHash().toString('hex');

		res.jsonp({status: 'success', data: {raw: rawtx, txid: txid}, code:'200', message:''});
	});
};


module.exports = WalletController;
