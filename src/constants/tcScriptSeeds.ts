// ============================================================
// JEET ERP — Testing & Commissioning Script Template Seeds
// ============================================================

import { ScriptType } from '../types/tc.types';

export interface SeedScriptTemplate {
  name: string;
  system: string;
  description: string;
  items: {
    script_type: ScriptType;
    test_item: string;
    expected: string;
    sort_order: number;
  }[];
}

export const TC_SCRIPT_SEEDS: SeedScriptTemplate[] = [
  {
    name: 'CCTV SIRA Compliance & Technical Checklist',
    system: 'CCTV',
    description: 'Standard SIRA compliant CCTV commissioning procedures including recording retention, UPS backup, and camera view validation.',
    items: [
      {
        script_type: 'DEVICE_LEVEL',
        test_item: 'Camera physical mounting and angling',
        expected: 'Camera securely mounted, focus and zoom set, blind spots minimized as per design drawings.',
        sort_order: 10
      },
      {
        script_type: 'DEVICE_LEVEL',
        test_item: 'Camera day/night mode transition',
        expected: 'IR cut filter engages correctly in low light. Image remains clear without excessive noise.',
        sort_order: 20
      },
      {
        script_type: 'SYSTEM_LEVEL',
        test_item: 'Storage retention verification (SIRA 31 Days)',
        expected: 'NVR/SAN storage capacity calculated and configured to store continuous/motion recording for minimum 31 days at mandated resolution (min 1080p) and frame rate (min 15fps).',
        sort_order: 30
      },
      {
        script_type: 'SYSTEM_LEVEL',
        test_item: 'UPS Backup duration validation',
        expected: 'CCTV rack UPS holds active load for minimum 30 minutes upon main power disconnect.',
        sort_order: 40
      },
      {
        script_type: 'SYSTEM_LEVEL',
        test_item: 'Video loss and tampering alerts',
        expected: 'Disconnecting a camera or covering the lens triggers an immediate alarm on the VMS client console.',
        sort_order: 50
      },
      {
        script_type: 'INTEGRATION',
        test_item: 'Time synchronization (NTP Server)',
        expected: 'All cameras and recording servers synchronized to a master NTP server within +/- 1 second.',
        sort_order: 60
      }
    ]
  },
  {
    name: 'Access Control System (ACS) & Fire Interlock Checklist',
    system: 'ACS',
    description: 'Access control checklist validating door status, reader operations, lock types, and mandatory fire alarm override release.',
    items: [
      {
        script_type: 'DEVICE_LEVEL',
        test_item: 'Reader card read range and feedback',
        expected: 'Card read within 5cm. LED turns green and buzzer sounds on valid read; LED flashes red on invalid.',
        sort_order: 10
      },
      {
        script_type: 'DEVICE_LEVEL',
        test_item: 'Door magnetic lock / strike release and alignment',
        expected: 'Door locks securely when closed. Magnetic lock releases immediately upon valid card read or exit button press.',
        sort_order: 20
      },
      {
        script_type: 'SYSTEM_LEVEL',
        test_item: 'Emergency exit button (break-glass) override',
        expected: 'Breaking/pressing emergency glass cuts power directly to magnetic locks locally, releasing the door immediately and logging an alarm.',
        sort_order: 30
      },
      {
        script_type: 'INTEGRATION',
        test_item: 'Fire Alarm door override interlock (Fail-Safe)',
        expected: 'On fire alarm activation, the master fire alarm panel interface relay cuts power to ALL fail-safe magnetic locks across the building, unlocking all doors instantly.',
        sort_order: 40
      },
      {
        script_type: 'SYSTEM_LEVEL',
        test_item: 'Door held open / forced open alarms',
        expected: 'Leaving door open past configured SLA (e.g. 15s) or forcing door open without swipe logs alarm in monitoring room.',
        sort_order: 50
      }
    ]
  },
  {
    name: 'Gate Barrier & ANPR System Integration Checklist',
    system: 'GATE_BARRIER',
    description: 'Vehicle gate barrier checklist including safety loops and ANPR camera plate recognition accuracy.',
    items: [
      {
        script_type: 'DEVICE_LEVEL',
        test_item: 'Gate barrier motor opening/closing time',
        expected: 'Barrier arm raises to full 90 degrees within 1.5 - 3 seconds depending on arm length, without bouncing.',
        sort_order: 10
      },
      {
        script_type: 'SYSTEM_LEVEL',
        test_item: 'Safety Loop and Photo-Cell logic verification',
        expected: 'Vehicle sitting on safety/presence loop prevents barrier arm from closing. Rebounds immediately if loop is broken during closing cycle.',
        sort_order: 20
      },
      {
        script_type: 'INTEGRATION',
        test_item: 'ANPR Camera Plate Recognition OCR accuracy',
        expected: 'Plate recognition camera reads standard UAE plates with >98% accuracy under day and night lighting conditions.',
        sort_order: 30
      },
      {
        script_type: 'INTEGRATION',
        test_item: 'ANPR Database Whitelist Barrier trigger',
        expected: 'Whitelisted vehicle plate detection automatically triggers gate barrier to open without manual guard intervention.',
        sort_order: 40
      }
    ]
  },
  {
    name: 'Structured Cabling (OTDR & Cat6A) Testing Checklist',
    system: 'STRUCTURED_CABLING',
    description: 'Commissioning checklist for copper and fiber cabling infrastructure.',
    items: [
      {
        script_type: 'DEVICE_LEVEL',
        test_item: 'Cat6A Permanent Link Certification tests',
        expected: 'All copper drops pass Fluke DSX-8000 validation for Wiremap, Insertion Loss, NEXT, and Return Loss up to 500MHz.',
        sort_order: 10
      },
      {
        script_type: 'DEVICE_LEVEL',
        test_item: 'Fiber Optic core OTDR trace testing',
        expected: 'OTDR trace reports for all fiber cores at 1310nm/1550nm show insertion loss <0.3dB per connector, splice loss <0.15dB, and zero anomalies.',
        sort_order: 20
      },
      {
        script_type: 'SYSTEM_LEVEL',
        test_item: 'Patch panel and faceplate labelling hierarchy',
        expected: 'All ports labeled correctly as per project standards (e.g. FD-01-A24 for Floor 1, Panel A, Port 24). Labels match layout drawings.',
        sort_order: 30
      }
    ]
  },
  {
    name: 'Building Management System (BMS) Point-to-Point Checklist',
    system: 'BMS',
    description: 'BMS Point-to-Point validation for controllers, DI/DO/AI/AO loops.',
    items: [
      {
        script_type: 'DEVICE_LEVEL',
        test_item: 'Digital Input (DI) point validation',
        expected: 'Physical change of status (e.g., pump run/trip contact closure) displays correctly on the BMS graphic workstation within 2 seconds.',
        sort_order: 10
      },
      {
        script_type: 'DEVICE_LEVEL',
        test_item: 'Analog Input (AI) calibration verification',
        expected: 'Temperature/Pressure sensor readings match calibrated reference thermometer/gauge within +/- 0.5 deg C or +/- 0.1 Bar.',
        sort_order: 20
      },
      {
        script_type: 'DEVICE_LEVEL',
        test_item: 'Digital Output (DO) control validation',
        expected: 'Commanding pump/fan to run from BMS workstation successfully energizes contactor coil and starts equipment.',
        sort_order: 30
      },
      {
        script_type: 'DEVICE_LEVEL',
        test_item: 'Analog Output (AO) modulator positioning',
        expected: 'Commanding chilled water valve actuator to 0%, 50%, 100% position reflects exact physical travel of valve stem.',
        sort_order: 40
      }
    ]
  }
];
