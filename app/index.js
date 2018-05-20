const gps = require('gps-tracking');
const path = require('path');
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const mongodb = require('mongodb').MongoClient, 
      assert = require('assert');
const mongourl = 'mongodb://localhost:27017/mi-gps';

app.set('port',8080);
app.use(express.static(path.join(__dirname,'/')))
//iniciando el servidor que escucha un determinado puerto
server.listen(app.get('port'), () => {
	console.log('Servidor escuchando puerto',app.get('port'));
})
//Configuracion del adaptador y puerto para el GPS
var options = {
    'debug' : false,
    'port' : 5002,
    'device_adapter' : 'TK103'
}

mongodb.connect(mongourl, function(err,db){
    assert.equal(null,err);
    console.log('Conectado a MONGODB');
    
    io.on('connection',socket => {
        let misdevices = db.collection('devices');
        console.log('cliente web conectado');

        misdevices.find({}).toArray(function(err,res){
            assert.equal(null,err);
            socket.emit('misdevices',res);
        });
    
        socket.on('add-gps',function(data){
            db.collection('devices').insert({
                name : data.name,
                identifier : data.identifier
            })
            socket.emit('update-devices',data);
        })
    
    });
    
    var miserver = gps.server(options, function(device,connection){
    
        device.on("connected",function(data){
            console.log("Hola soy un nuevo dispositivo");
            return data;
        });
    
        device.on("login_request",function(device_id,msg_parts){
            console.log('Mi ID es '+device_id+' Quiero empezar a transmitir mis cordenadas. '+msg_parts);
            //Aqui se comprobara que es dispositivo haya sido registrado previamente.
            db.collection('devices').find({"identifier":device_id}).count(function(err,cont){
                assert.equal(null,err);
                console.log(cont);
                if(cont===1){
                    console.log('Dispositivo Aceptado');
                    device.login_authorized(true);
                }else{
                    console.log('No se permite el Dispositivo');
                } 
            });
                  
        });
    
        device.on("ping",function(data){
            data.uid = this.getUID();
            //Mandamos la data por socket al cliente web
            //io.emit("ping",data);
            console.log(data);
            console.log("Me encuentro en "+data.latitude+" , "+data.longitude+" ("+this.getUID()+") ");
            //var inser_data;
            if(data!='undefined'){
                io.emit('ping',data);
            }
            return data;
        });

        device.on("alarm",function(alarm_code, alarm_data, msg_data) {
			console.log("Help! Something happend: " + alarm_code + " (" + alarm_data.msg + ")");
		}); 

		//Also, you can listen on the native connection object
		connection.on('data', function(data) {
			//echo raw data package
			console.log(data.toString()); 
		});

    
    })
    
    //EVENTOS DEL CLIENTE WEB

})


