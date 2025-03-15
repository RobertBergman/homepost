// Mock for SQLite database operations
const { EventEmitter } = require('events');

// In-memory database storage
const mockData = {
  devices: [],
  transcriptions: [],
  alerts: []
};

// Mock database counter for auto-incrementing IDs
let idCounter = 1;

// Mock results for update and other operations - make a function to get fresh objects
const createMockChanges = () => ({
  changes: 1, // Default to 1 change for operations
  lastID: 0   // Will be updated for insert operations
});

// Create a mock db object
const mockDb = {
  // Query execution methods
  run: jest.fn((sql, params) => {
    const mockChanges = createMockChanges();
    const operation = sql.trim().split(' ')[0].toLowerCase();
    
    if (operation === 'insert') {
      mockChanges.lastID = idCounter++;
      
      // Handle different tables
      if (sql.includes('devices')) {
        const [id, name, location, capabilities, last_seen] = params;
        mockData.devices.push({ id, name, location, capabilities, last_seen });
      } else if (sql.includes('transcriptions')) {
        const [device_id, timestamp, text, confidence] = params;
        mockData.transcriptions.push({ 
          id: mockChanges.lastID, 
          device_id, 
          timestamp, 
          text, 
          confidence 
        });
      } else if (sql.includes('alerts')) {
        const [device_id, timestamp, type, message, status] = params;
        mockData.alerts.push({ 
          id: mockChanges.lastID, 
          device_id, 
          timestamp, 
          type, 
          message, 
          status 
        });
      }
    } else if (operation === 'update') {
      if (sql.includes('devices')) {
        // Find device by ID (usually last parameter)
        const id = params[params.length - 1];
        const deviceIndex = mockData.devices.findIndex(d => d.id === id);
        if (deviceIndex !== -1) {
          // Update the found device
          if (sql.includes('SET name')) {
            // Handle full update
            mockData.devices[deviceIndex].name = params[0];
            mockData.devices[deviceIndex].location = params[1];
            mockData.devices[deviceIndex].capabilities = params[2];
            mockData.devices[deviceIndex].last_seen = params[3];
          } else if (sql.includes('last_seen')) {
            mockData.devices[deviceIndex].last_seen = params[0];
          } else if (sql.includes('capabilities')) {
            mockData.devices[deviceIndex].capabilities = params[0];
          }
        } else {
          mockChanges.changes = 0; // No device found
        }
      } else if (sql.includes('alerts')) {
        // Update alert status
        const id = params[params.length - 1];
        // Use == for number/string comparison
        const alertIndex = mockData.alerts.findIndex(a => a.id == id);
        if (alertIndex !== -1) {
          mockData.alerts[alertIndex].status = params[0];
        } else {
          mockChanges.changes = 0; // No alert found
        }
      }
    } else if (operation === 'delete') {
      // Implement delete if needed
      mockChanges.changes = 1;
    }
    
    return Promise.resolve(mockChanges);
  }),
  
  // Single row query
  get: jest.fn((sql, params) => {
    let result = null;
    
    // Handle different queries
    if (sql.includes('devices')) {
      const deviceId = params[0]; // Usually the first parameter is the ID
      result = mockData.devices.find(d => d.id === deviceId) || null;
    } else if (sql.includes('alerts')) {
      const alertId = params[0];
      result = mockData.alerts.find(a => a.id == alertId) || null; // Use == for number/string comparison
    } else if (sql.includes('COUNT') || sql.toLowerCase().includes('count(*) as total')) {
      let count = 0;
      
      if (sql.includes('devices')) {
        count = mockData.devices.length;
      } else if (sql.includes('transcriptions')) {
        count = mockData.transcriptions.length;
      } else if (sql.includes('alerts')) {
        count = mockData.alerts.length;
      }
      
      result = { total: count };
    }
    
    // Always return at least an object with total: 0 for COUNT queries
    if (sql.toLowerCase().includes('count(*) as total') && !result) {
      result = { total: 0 };
    }
    
    return Promise.resolve(result);
  }),
  
  // Multiple rows query
  all: jest.fn((sql, params = []) => {
    let results = [];
    
    // Basic filtering for WHERE clauses
    const filterByConditions = (items, conditions) => {
      if (!conditions || conditions.length === 0) return items;
      
      return items.filter(item => {
        // Check all conditions
        for (let i = 0; i < conditions.length; i++) {
          const condition = conditions[i];
          const param = params[i];
          
          if (condition.includes('device_id =')) {
            if (item.device_id !== param) return false;
          } else if (condition.includes('status =')) {
            if (item.status !== param) return false;
          } else if (condition.includes('type =')) {
            if (item.type !== param) return false;
          } else if (condition.includes('text LIKE')) {
            // Handle LIKE operator with % wildcards
            const searchTerm = param.replace(/%/g, '');
            if (!item.text.includes(searchTerm)) return false;
          } else if (condition.includes('last_seen >')) {
            // Date comparison
            const itemDate = new Date(item.last_seen).getTime();
            const paramDate = new Date(param).getTime();
            if (itemDate <= paramDate) return false;
          }
        }
        return true;
      });
    };
    
    // Handle different tables
    if (sql.includes('devices')) {
      results = [...mockData.devices];
    } else if (sql.includes('transcriptions')) {
      results = [...mockData.transcriptions];
    } else if (sql.includes('alerts')) {
      results = [...mockData.alerts];
    }
    
    // Handle WHERE conditions
    const whereMatch = sql.match(/WHERE\s+(.*?)(?:ORDER BY|LIMIT|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      const conditions = whereClause.split('AND').map(c => c.trim());
      results = filterByConditions(results, conditions);
    }
    
    // Handle ORDER BY
    if (sql.includes('ORDER BY')) {
      const orderMatch = sql.match(/ORDER BY\s+(.*?)(?:LIMIT|$)/i);
      if (orderMatch) {
        const orderClause = orderMatch[1];
        const [field, direction] = orderClause.split(/\s+/);
        
        results.sort((a, b) => {
          if (direction && direction.toUpperCase() === 'DESC') {
            return a[field] > b[field] ? -1 : 1;
          }
          return a[field] > b[field] ? 1 : -1;
        });
      }
    }
    
    // Handle LIMIT and OFFSET
    if (sql.includes('LIMIT')) {
      const limitMatch = sql.match(/LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?/i);
      if (limitMatch) {
        const limit = parseInt(params[params.length - 2], 10);
        const offset = parseInt(params[params.length - 1], 10);
        
        results = results.slice(offset, offset + limit);
      }
    }
    
    return Promise.resolve(results);
  }),
  
  // Execute raw SQL (used for setup)
  exec: jest.fn((sql) => {
    // Just resolve, we don't need to do anything here for tests
    return Promise.resolve();
  }),
  
  // Reset the mock data for tests
  _reset: () => {
    mockData.devices = [];
    mockData.transcriptions = [];
    mockData.alerts = [];
    idCounter = 1;
  }
};

// Mock the entire SQLite module
const mockOpen = jest.fn(() => {
  return Promise.resolve(mockDb);
});

module.exports = {
  mockDb,
  mockOpen,
  mockData
};