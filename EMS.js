/*
V1.0 P.Boldt 06.04.2025
Dieses Skript errechnet die 15min Energieverbräuche von selbst definierten Messstellen, angelehnt an die ISO 500001. Die Werte werden in einer IoBroker SQL instanz gespeichet.
Durch den 15min INtervall lassen sich die Tagessummen in z.B. Grafana gut darstellen, auch die Darstellung des Lastverlaufs ist möglich. So kann man den Energieverbrauch über verschiedene Zeitspannen monitoren.

Funktion:

Grundsätzlich
Das Skript vergleicht den aktuellen Zählerstand (z.B. aus einem Shelly) mit dem vor 15min. Die Differenz wird in die SQL Datenbank eingetragen.

Plausibilität
Es kann eine max Grenze (Plausibilität) eingetragen angegeben werden. Wenn dieser Wert überschritten wird (pro 15min Intervall), guckt das Skript, ob Zählwerte fehlen.
Falls dies der Fall ist, wird geguckt wie viele Werte fehlen und der Wert dann durch die Anzahl fehlender Werte geteilt. Ist dieser Wert dann unter der Plausibilitätsprüfung, wird er normal eingetragen.
So stimmt die Energiesumme über den ganzen Zeitraum wieder. ISt der Wert immernoch über der Plausibilitätsgrenze, wird ein Druchschnitt aus der Datenbank geholt und eingetragen.

Zählerüberlauf
Wird ein Zählerüberlauf erkann (15min Differnez negativ), wird ebenfalls ein Druchschnitt aus der Datenbank gejolt und eingetragen

Überwachung:
Es kann eine Überwachungszeit eingestellt werden. Wenn sich der Zöhler über diese Zeit nicht ändert, wird eine Telegramm Nachricht gesendet. Es gibt zwei Überwachungsmodi: Prüfen, ob sich der Zählerstand ändert und Prüfen, wann der letztte Wert in IoBroker aufeglaufen ist (Timestamp).
Die erste Methode kann sinnvoll sein, wenn man mit einem Sensor einen Impukszähler auswertet und mit z.B. ESP Home an IoBroker sendet. Wenn der Sensor defekt ist, wir der Wert in IoBroker zwar aktualisiert, aber der Zähler läuft nicht hoch.
Die zweite Methode (Timestamp) ist sinnvoll, wenn man Zähler hat, direkt an IoBroker senden (z.B. Shelly) oder die auch längere Zeit nichts messen (z.B. ein Hauptzähler, wenn durch ein Balkonkraftwerk eingespeist wird).


Sprzifische Anpassungen:

-SQl Logindaten müssen ab Zeile 52 angepasst werden
-Ab Zeile 70 werden die Messstellen  eingetragen: 
    - Name: Selbst definierter Name der Messstelle
    - max: Grenze für Plausibilität
    - Einheit: Erklärt sich von selbst
    - aufbewahrung_tage: wie lange sollen die Daten in der Datenbank vorgehalten werden
    - ueberwachungszeit: Überwachungszeit in Stunden
    - timeout Art: 0=Kein Zähleränderung, 1=Timestamp überprüfung

-In Zeile 104 und 125 muss die sql Instanz angepast werden (2x: 15min Differenz und letzter Wert)
-In Zeile 236 und 259 muss die Einstellung für den Telegramm Versand eingestellt werden





*/



const mysql = require('mysql');

const path = '0_userdata.0.EMS.'                        // Pfad der Variablen

let Messstellen = [];                                   // Array für Messstellen Daten
const sql_connection= mysql.createConnection({           //SQL Verbindungsparameter
  host: "xxx.xxx.xxx.xxx",
  port: '3306',
  user: "user",
  password: "xxxxxx",
  database: "Energie_15min"
});

let sql_settings_15m                                    
let sql_settings_letzter_wert
let letzter_wert = 0;
let aktueller_wert = 0 
let diff_15m = 0
let id = "test"
let heute; 		


// Hier alle Messstellen eintragen
Messstellen.push({ name: 'test1', max: 10, zaehler: 'esphome.0.807D3A2691DB.Sensor.173145652.state'/*State of Total energy*/, einheit: 'kwh', aufbewahrung_tage: 365, ueberwachungszeit: 1, timeout_methode: 1});
Messstellen.push({ name: 'twst2', max: 10, zaehler: 'esphome.0.807D3A2691DB.Sensor.3562582910.state'/*State of Total eingespeist*/, einheit: 'kwh', aufbewahrung_tage: 365, ueberwachungszeit: 24, timeout_methode: 1 });






var sql_abfrage_avg = function (messstelle,offset) {
    return new Promise(function (resolve, reject) {
        var sql = "SELECT avg(val) as val FROM ts_number WHERE id = (select id from datapoints where name =\"" + messstelle   + "\") ORDER BY ts DESC LIMIT 192 OFFSET " + offset;   
        sql_connection.query(sql, function (err, result) {
            console.log("avg query: " + sql);
            if (err){
                 resolve(0);
            }
            else  {
                console.log("AVG result: " + result[0].val)
                resolve(result[0].val);
            }
        });
    });
};





// -------------Objekte anlgen, falls nicht vorhanden-----------------

for (var i = 0; i<Messstellen.length; i++)
{

    sql_settings_15m = {                //EInstellungen für SQL Instanz (15min Wert)
        "sql.3": {
          "enabled": true,
          "storageType": "",
          "counter": false,
          "aliasId": Messstellen[i].name,
          "debounceTime": 300,
          "blockTime": 0,
          "changesOnly": true,
          "changesRelogInterval": 0,
          "changesMinDelta": 0,
          "ignoreBelowNumber": "",
          "disableSkippedValueLogging": false,
          "retention": 63072000,
          "customRetentionDuration": Messstellen[i].aufbewahrung_tage,
          "maxLength": 0,
          "enableDebugLogs": false,
          "debounce": 1000
        }
    }

        sql_settings_letzter_wert = {                //EInstellungen für SQL Instanz (letzer Zählwert)
        "sql.3": {
          "enabled": true,
          "storageType": "",
          "counter": false,
          "aliasId": Messstellen[i].name + '_Zaehler',
          "debounceTime": 300,
          "blockTime": 0,
          "changesOnly": true,
          "changesRelogInterval": 0,
          "changesMinDelta": 0,
          "ignoreBelowNumber": "",
          "disableSkippedValueLogging": false,
          "retention": 63072000,
          "customRetentionDuration": Messstellen[i].aufbewahrung_tage,
          "maxLength": 0,
          "enableDebugLogs": false,
          "debounce": 1000
        }
    }
    
 
    if ( !existsState(path + Messstellen[i].name + '.Diff_15m' )) {                 // Diff_15m anlegen
        createState(path + Messstellen[i].name + '.Diff_15m', 0, {
         name: "Diff_15m",
         type: "number",
         role: "value",
         unit: Messstellen[i].einheit,
         custom: sql_settings_15m
         
        });
    }

    

    var initval = getState(Messstellen[i].zaehler).val;
   
    if ( !existsState(path + Messstellen[i].name + '.letzter_Wert' )) {             // letzter_Wert anlegen
        createState(path + Messstellen[i].name + '.letzter_Wert', initval, {
         name: "letzter_Wert",
         type: "number",
         role: "value",
         unit: Messstellen[i].einheit,
         custom: sql_settings_letzter_wert,
        
         

        });




        


    }



    if ( !existsState(path + Messstellen[i].name + '.ueberwachungszaehler' )) {             // Überewachungszähler anlegen
        createState(path + Messstellen[i].name + '.ueberwachungszaehler', 0, {
         name: "ueberwachungszaehler",
         type: "number",
         role: "value"
         
         
        
         

        });


        


    }

    if ( !existsState(path + Messstellen[i].name + '.Warnung' )) {             // Warnung anlegen
        createState(path + Messstellen[i].name + '.Warnung', 0, {
         name: "Warnung",
         type: "number",
         role: "value",

        
         

        });
    }

}
async function Berechnung()
{

    for (var i = 0; i<Messstellen.length; i++)                                                                      //jede Messstelle berechnen
    {
    id = path + Messstellen[i].name + '.letzter_Wert';                                                              //Variablenname letzter Wert zusammenstellen
    letzter_wert=getState(id).val;                                                                                  //letzten Zählwert auslesen                                                   
    console.log("Messstelle " +  Messstellen[i].name + ": letzter Wert vor Berechnung =: " + letzter_wert);
    aktueller_wert=getState(Messstellen[i].zaehler).val;                                                            // aktuellen Zählerstand auslesen
    console.log("Messstelle " +  Messstellen[i].name + ": aktueller Wert =: " + aktueller_wert);
    diff_15m = (aktueller_wert - letzter_wert);                                                                     // Differenz bilden
    console.log("Messstelle " +  Messstellen[i].name + ": 15 min Differenz =: " + diff_15m);
    if(Messstellen[i].timeout_methode==0){
    if (diff_15m == 0)                                                                                               // Wenn sich Zähler nicht verändert hat
    {
        var ueb_count = getState(path + Messstellen[i].name + ".ueberwachungszaehler").val;                         // Überwachungszähler erhöhen
        ueb_count=ueb_count + 1;
        setState(path + Messstellen[i].name + ".ueberwachungszaehler",ueb_count);
        if (ueb_count >= Messstellen[i].ueberwachungszeit/4)
        {
            var Warnung=getState(path + Messstellen[i].name + ".Warnung").val;
            if(Warnung==0){
             sendTo('telegram.0', "Überwachungszeit Energiezähler " + Messstellen[i].name + " abgelaufen!");
             setState(path + Messstellen[i].name + ".Warnung",1); 
            }
        }
    }
    }

    if(Messstellen[i].timeout_methode==1){
        var last_TS = getState(Messstellen[i].zaehler).ts;
        console.log("last TS= " + last_TS);
        heute = new Date();
        var time_now = heute.getTime();
     
        console.log("time now= " + time_now);
        var ueb_count1 = time_now-last_TS;
        ueb_count1 = ueb_count1/1000/60/60; 
        console.log("ueb_count= " + ueb_count1);
        setState(path + Messstellen[i].name + ".ueberwachungszaehler",ueb_count1);

        if (ueb_count1 >= Messstellen[i].ueberwachungszeit*4)
        {
            var Warnung=getState(path + Messstellen[i].name + ".Warnung").val;
            if(Warnung==0){
             sendTo('telegram.0', "Überwachungszeit Energiezähler " + Messstellen[i].name + " abgelaufen!");
             setState(path + Messstellen[i].name + ".Warnung",1); 
            }
        }
    }


    if(diff_15m>Messstellen[i].max)                                                             // wenn größer als max Mittelwert eintragen
    {
       
            var last_time = getState(path + Messstellen[i].name + ".ueberwachungszaehler").val;     //Überwacungszähler auslesen
            if (last_time > 0){
                heute = new Date();
                var time_now = heute.getTime();  
                last_time=last_time*4;                                                                  //Umrechnung auf Stunden
                last_time=last_time*60;                                                                 //Umrechnung auf min
                last_time=last_time*60;                                                                 //Umrechnung auf Sek
                last_time=last_time*1000;                                                               //Umrechnung auf ms
                last_time=time_now-last_time;
            }
            else{
                heute = new Date();
                var time_now = heute.getTime();  
                last_time=time_now;
            }
                console.log("letzte Zeit: " + last_time);
                console.log("jetzt: " + time_now);
                var time_diff = time_now - last_time;
                time_diff=time_diff/1000;                                                               //in Sekunden umrechnen
                time_diff=time_diff/60;                                                                 //in Minuten umrechnen
                time_diff=time_diff/60;                                                                 //in Stunden umrechnen
                console.log("zeitdifferenz: " + time_diff);
                var theor_Anzahl = time_diff/4;                                                          //Anzahl theoretisch
                console.log("Fehlende Werte: " + theor_Anzahl);

            if (theor_Anzahl>0){
                if((diff_15m/theor_Anzahl)>Messstellen[i].max) {                                                              //wenn Durchschnitt immernoch über max
        
                                
                  try {
                 
                        var temp1 = await sql_abfrage_avg(Messstellen[i].name,theor_Anzahl );                         //Durchschnitt aus DB laden
                     } catch (error) {
                                console.log(error);
                            }
          
                    diff_15m=temp1*theor_Anzahl;                                                                                //Durchschnittswert mal fehlende Zählwerte

                }


        
            }
            else{
                try {
                 var temp1 = await sql_abfrage_avg(Messstellen[i].name,theor_Anzahl);                                                   //Durchschnitt aus DB laden
                } catch (error) {
                                console.log(error);
                            }
          
                diff_15m=temp1;                                                                       //Durchschnittswert eintragen
 

             }


        

 
    }

    if(diff_15m<0)                                                                              // wenn Differenz negativ
    {
        try {
             var temp1 = await sql_abfrage_avg(Messstellen[i].name, 0);                         //Durchschnitt aus DB laden
        } catch (error) {
                         console.log(error);
                    }
            sendTo('telegram.0', "Zählerüberlauf Energiezähler " + Messstellen[i].name);
            diff_15m=temp1;                                                                 //Durchschnittswert eintragen
            

    }


    console.log("Messstelle " +  Messstellen[i].name + ": 15 min Differenz =: " + diff_15m);
    console.log("Messstelle " +  Messstellen[i].name + ": letzter Wert =: " + letzter_wert);


if( diff_15m>0){
            setState(path + Messstellen[i].name + ".ueberwachungszaehler",0);                                           //Überwacungszeit zurücksetzen
            setState(path + Messstellen[i].name + ".Warnung",0); 
}

    setState(path + Messstellen[i].name + ".Diff_15m", diff_15m);
    setState(path + Messstellen[i].name + ".letzter_Wert", aktueller_wert);

}


}

// ---------------------Energieberechnung alle 15 min----------------------------
schedule('*/15 * * * *', function () {
Berechnung();

})
