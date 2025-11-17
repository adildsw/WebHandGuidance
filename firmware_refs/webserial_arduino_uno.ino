#include <Wire.h>
#include <SparkFunLSM9DS1.h>
#include "Adafruit_DRV2605.h"

#define SERIAL_TX_BUFFER_SIZE 128
#define SERIAL_RX_BUFFER_SIZE 128

LSM9DS1 imu;

Adafruit_DRV2605 drv;

// order: L F R B top bottom
// order: L F F B Left bottom
int motors [] =  {16, 0, 15, 13, 12, 14};
uint8_t receivedData[6];

// Timing variables
unsigned long lastAccelSendTime = 0;
const unsigned long accelSendInterval = 20; // 20ms interval for sending acceleration data

void setup() {
  Serial.begin(115200);
//  Serial.setRxBufferSize(128);  // ESP8266 specific
  Serial.setTimeout(1);         // Reduce timeout for faster processing

  Wire.begin();

  
  drv.begin();
  drv.useLRA();
  drv.setMode(DRV2605_MODE_PWMANALOG);

  // Initialize IMU
  if (!imu.begin()) {
    Serial.println("Failed to initialize IMU!");
    while (1); // Halt if IMU initialization fails
  }


  // Initialize motor pins
  for (int i = 0; i < 6; i++) {
    pinMode(motors[i], OUTPUT);
  }
  delay(500);
}

void loop() {
  unsigned long currentTime = millis();

  updateIMUData();

  // Send acceleration data at specified interval
  if (currentTime - lastAccelSendTime >= accelSendInterval) {
    sendBinaryAccelerationData();
    lastAccelSendTime = currentTime;
  }

  processMotorCommands();
  yield();
}

void updateIMUData() {
  if (imu.accelAvailable())
    imu.readAccel();
}

void sendBinaryAccelerationData() {
    float ax = imu.calcAccel(imu.ax);
    float ay = imu.calcAccel(imu.ay);
    float az = imu.calcAccel(imu.az);

    // Send a start marker
    uint8_t startMarker = 0xFF;
    Serial.write(startMarker);
    
    // Send floats as bytes
    Serial.write((uint8_t*)&ax, 4);
    Serial.write((uint8_t*)&ay, 4);
    Serial.write((uint8_t*)&az, 4);
    
    // Send end marker
    uint8_t endMarker = 0xFE;
    Serial.write(endMarker);
    
    Serial.flush();
}
void sendAccelerationData() {
  float ax = imu.calcAccel(imu.ax);
  float ay = imu.calcAccel(imu.ay);
  float az = imu.calcAccel(imu.az);

  Serial.print(ax,2);
  Serial.print(",");
  Serial.print(ay,2);
  Serial.print(",");
  Serial.print(az,2);
  Serial.println();
  Serial.flush();
}

void processMotorCommands() {
  if (Serial.available() >= 6) {
    for (int i = 0; i < 6; i++) {
      receivedData[i] = Serial.read();
    }

    for (int i = 0; i < 6; i++) {
      setMotor(i, receivedData[i]);
    }
  }
}

void setMotor(int id, int val) {
  analogWrite(motors[id], val);
}

void setMotor2(int id, int val) {
  for (int i = 0; i < 6; i++) {
    if (i != id)
      analogWrite(motors[i], 0);
    else
      analogWrite(motors[i], val);
  }
}