// Mock for LangGraph
class MockLangGraph {
  constructor(config) {
    this.config = config;
    this.nodes = config.nodes;
    this.edges = config.edges;
  }

  async invoke(input) {
    // Simulate processing through the graph
    let result = input;
    
    for (const node of this.nodes) {
      result = await node.action(result);
    }
    
    return result;
  }
}

module.exports = {
  LangGraph: MockLangGraph
};