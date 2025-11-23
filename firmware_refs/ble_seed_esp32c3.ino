#include <Wire.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <SparkFunLSM9DS1.h>

#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define MOTOR_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define IMU_CHAR_UUID "8f022099-36b0-44cd-909e-d24cc105895a"

LSM9DS1 imu;

int motor_up = 0;
int motor_down = 0;
int motor_left = 0;
int motor_right = 0;
int motor_forward = 0;
int motor_backward = 0;

float ax = 0.0f;
float ay = 0.0f;
float az = 0.0f;

unsigned long lastAccelSendTime = 0;
const unsigned long accelSendInterval = 20;


BLECharacteristic *pMotorCharacteristic = nullptr;
BLECharacteristic *pIMUCharacteristic = nullptr;

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) {
    Serial.println("[INFO] Device Connected");
  }

  void onDisconnect(BLEServer *pServer) {
    Serial.println("[INFO] Device Disconnected");
    pServer->getAdvertising()->start();
  }
};

class MotorConfigCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    String raw = pCharacteristic->getValue();
    if (raw.length() == 0) return;

    String value = String(raw.c_str());
    int vals[6];
    int idx = 0;
    int lastIndex = 0;

    for (int i = 0; i <= value.length(); i++) {
      if (value.charAt(i) == ',' || i == value.length()) {
        if (idx < 6) {
          String part = value.substring(lastIndex, i);
          part.trim();
          vals[idx] = part.toInt();
          idx++;
        }
        lastIndex = i + 1;
      }
      if (idx >= 6) break;
    }

    if (idx == 6) {
      motor_up = vals[0];
      motor_down = vals[1];
      motor_left = vals[2];
      motor_right = vals[3];
      motor_forward = vals[4];
      motor_backward = vals[5];
    }

    Serial.print("[INFO] Received Vibration Data: ");
    Serial.println(value);
  }
};

void setup() {
  Serial.begin(115200);

  Wire.begin();
  if (!imu.begin()) {
    Serial.println("Failed to initialize IMU!");
    while (1)
      ;  // Halt if IMU initialization fails
  }


  BLEDevice::init("HandGuidanceDevice");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pMotorCharacteristic = pService->createCharacteristic(
    MOTOR_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE);
  pMotorCharacteristic->setCallbacks(new MotorConfigCallbacks());
  String initialMotor = String(motor_up) + "," + String(motor_down) + "," + String(motor_left) + "," + String(motor_right) + "," + String(motor_forward) + "," + String(motor_backward);
  pMotorCharacteristic->setValue(initialMotor.c_str());

  pIMUCharacteristic = pService->createCharacteristic(
    IMU_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  String initialIMU = String(ax, 2) + "," + String(ay, 2) + "," + String(az, 2);
  pIMUCharacteristic->setValue(initialIMU.c_str());

  pService->start();
  BLEAdvertising *pAdvertising = pServer->getAdvertising();
  pAdvertising->setMinInterval(0x20);  // 20ms
  pAdvertising->setMaxInterval(0x40);  // 40ms
  pAdvertising->setScanResponse(true);
  pAdvertising->start();
  Serial.println("[INFO] Device Initialized");
}

void updateIMUData() {
  if (imu.accelAvailable())
    imu.readAccel();
}

void loop() {
  unsigned long currentTime = millis();
  
  if (currentTime - lastAccelSendTime >= accelSendInterval) {
    updateIMUData();
    float ax = imu.calcAccel(imu.ax);
    float ay = imu.calcAccel(imu.ay);
    float az = imu.calcAccel(imu.az);

    char imuBuf[64];
    snprintf(imuBuf, sizeof(imuBuf), "%.2f,%.2f,%.2f", ax, ay, az);
    if (pIMUCharacteristic) {
      pIMUCharacteristic->setValue((uint8_t *)imuBuf, strlen(imuBuf));
      pIMUCharacteristic->notify();
    }

    lastAccelSendTime = currentTime;
  }
}