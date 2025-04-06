# Iobroker_EMS
Skript für ein Energiemonitoring in Iobroker

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

Es kann eine Überwachungszeit eingestellt werden. Wenn sich der Zöhler über diese Zeit nicht ändert, wird eine Telegramm Nachricht gesendet


Sprzifische Anpassungen:

-SQl Logindaten müssen ab Zeile 48 angepasst werden

-Ab Zeile 66 werden die Messstellen  eingetragen: 
    - Name: Selbst definierter Name der Messstelle
    - max: Grenze für Plausibilität
    - Einheit: Erklärt sich von selbst
    - aufbewahrung_tage: wie lange sollen die Daten in der Datenbank vorgehalten werden
    - ueberwachungszeit: Überwachungszeit in Stunden

-In Zeile 98 und 120 muss die sql Instanz angepast werden (2x: 15min Differenz und letzter Wert)

-In Zeile 212 muss die Einstellung für den Telegramm Versand eingestellt werden
