// Mock implementation of @langchain/langgraph
class StateGraph {
  constructor(options = {}) {
    this.channels = options.channels || {};
    this.nodes = new Map();
    this.edges = [];
    
    // Add a default start node that's always accessible
    this.nodes.set('__start__', state => state);
  }

  addNode(name, action) {
    this.nodes.set(name, action);
    return this;
  }

  addEdge(from, to) {
    this.edges.push({ from, to });
    return this;
  }

  // Methods expected by the v0.0.11 API
  addConditionalEdges() {
    return this;
  }
  
  validate() {
    return true;
  }

  compile() {
    // Return a mock compiled workflow that can be invoked
    return {
      invoke: async (state) => {
        let currentState = { ...state };
        
        // Process the state through our mock workflow
        if (currentState.text && currentState.text.includes('help') && !currentState.text.includes('helpful')) {
          currentState.alerts = [{ phrase: 'help', severity: 'medium' }];
        }
        if (currentState.text && currentState.text.includes('emergency')) {
          currentState.alerts = [...(currentState.alerts || []), { phrase: 'emergency', severity: 'high' }];
        }
        if (currentState.text && currentState.text.includes('fire')) {
          currentState.alerts = [...(currentState.alerts || []), { phrase: 'fire', severity: 'high' }];
        }
                
        return currentState;
      }
    };
  }
}

module.exports = { StateGraph };
