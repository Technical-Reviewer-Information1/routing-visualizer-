import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import networkx as nx
import json
import time
import random
from typing import Dict, List, Tuple, Optional
import copy

st.set_page_config(
    page_title="ルーティング可視化シミュレーター",
    page_icon="🌐",
    layout="wide",
    initial_sidebar_state="collapsed"
)

st.title("🌐 ルーティング可視化シミュレーター")
st.caption("Created by Dit-Lab.(Daiki ITO)")
st.caption("Supported by Tomoaki ATSUMI")

st.markdown("""
**ネットワークルーティングの世界を探検しよう！**  
このシミュレーターでは、パケットがネットワークを旅する様子や、ルーターがどのように最適な経路を選択するかを視覚的に学習できます。
""")

class NetworkNode:
    def __init__(self, node_id: str, name: str, node_type: str, position: Tuple[float, float], networks: List[str] = None):
        self.node_id = node_id
        self.name = name
        self.node_type = node_type  # 'router' or 'network'
        self.position = position
        self.networks = networks or []
        self.routing_table = {}
        self.interfaces = {}
        self.is_active = True

class NetworkLink:
    def __init__(self, source: str, target: str, interface_source: str = None, interface_target: str = None, cost: int = 1):
        self.source = source
        self.target = target
        self.interface_source = interface_source
        self.interface_target = interface_target
        self.cost = cost
        self.is_active = True

class RoutingEntry:
    def __init__(self, destination: str, gateway: str, interface: str, metric: int, protocol: str = "Static"):
        self.destination = destination
        self.gateway = gateway
        self.interface = interface
        self.metric = metric
        self.protocol = protocol

class NetworkSimulator:
    def __init__(self):
        self.nodes = {}
        self.links = []
        self.routing_tables = {}
        self.event_log = []
        self.initialize_default_network()
    
    def initialize_default_network(self):
        # ネットワークノード（サブネット）の作成
        networks = [
            NetworkNode("net1", "192.168.1.0/24", "network", (100, 300)),
            NetworkNode("net2", "192.168.2.0/24", "network", (500, 300)),
            NetworkNode("net3", "192.168.3.0/24", "network", (900, 300)),
            NetworkNode("net4", "192.168.4.0/24", "network", (300, 100)),
            NetworkNode("net5", "192.168.5.0/24", "network", (700, 100)),
        ]
        
        # ルーターノードの作成
        routers = [
            NetworkNode("R1", "ルーター1", "router", (300, 300)),
            NetworkNode("R2", "ルーター2", "router", (500, 200)),
            NetworkNode("R3", "ルーター3", "router", (700, 300)),
        ]
        
        # ノードを辞書に追加
        for node in networks + routers:
            self.nodes[node.node_id] = node
        
        # リンクの作成
        self.links = [
            NetworkLink("net1", "R1", cost=0),
            NetworkLink("R1", "net4", cost=0),
            NetworkLink("R1", "R2", "eth1", "eth0", cost=1),
            NetworkLink("net2", "R2", cost=0),
            NetworkLink("R2", "net5", "eth2", cost=0),
            NetworkLink("R2", "R3", "eth1", "eth0", cost=1),
            NetworkLink("R3", "net3", cost=0),
        ]
        
        # ルーティングテーブルの初期化
        self.initialize_routing_tables()
    
    def initialize_routing_tables(self):
        # 静的ルーティングテーブルの設定
        self.routing_tables = {
            "R1": {
                "192.168.1.0/24": RoutingEntry("192.168.1.0/24", "0.0.0.0", "eth0", 0, "Connected"),
                "192.168.4.0/24": RoutingEntry("192.168.4.0/24", "0.0.0.0", "eth2", 0, "Connected"),
                "192.168.2.0/24": RoutingEntry("192.168.2.0/24", "192.168.100.2", "eth1", 1, "Static"),
                "192.168.5.0/24": RoutingEntry("192.168.5.0/24", "192.168.100.2", "eth1", 2, "Static"),
                "192.168.3.0/24": RoutingEntry("192.168.3.0/24", "192.168.100.2", "eth1", 2, "Static"),
            },
            "R2": {
                "192.168.2.0/24": RoutingEntry("192.168.2.0/24", "0.0.0.0", "eth2", 0, "Connected"),
                "192.168.5.0/24": RoutingEntry("192.168.5.0/24", "0.0.0.0", "eth3", 0, "Connected"),
                "192.168.1.0/24": RoutingEntry("192.168.1.0/24", "192.168.100.1", "eth0", 1, "Static"),
                "192.168.4.0/24": RoutingEntry("192.168.4.0/24", "192.168.100.1", "eth0", 2, "Static"),
                "192.168.3.0/24": RoutingEntry("192.168.3.0/24", "192.168.200.3", "eth1", 1, "Static"),
            },
            "R3": {
                "192.168.3.0/24": RoutingEntry("192.168.3.0/24", "0.0.0.0", "eth2", 0, "Connected"),
                "192.168.2.0/24": RoutingEntry("192.168.2.0/24", "192.168.200.2", "eth0", 1, "Static"),
                "192.168.5.0/24": RoutingEntry("192.168.5.0/24", "192.168.200.2", "eth0", 2, "Static"),
                "192.168.1.0/24": RoutingEntry("192.168.1.0/24", "192.168.200.2", "eth0", 2, "Static"),
                "192.168.4.0/24": RoutingEntry("192.168.4.0/24", "192.168.200.2", "eth0", 3, "Static"),
            }
        }
    
    def find_path(self, source_net: str, dest_net: str) -> List[str]:
        # 最短パス探索（簡単な実装）
        if source_net == dest_net:
            return [source_net]
        
        # 各ネットワークに接続されたルーターを見つける
        source_router = None
        dest_router = None
        
        for link in self.links:
            if link.source == source_net and self.nodes[link.target].node_type == "router":
                source_router = link.target
            elif link.target == source_net and self.nodes[link.source].node_type == "router":
                source_router = link.source
            elif link.source == dest_net and self.nodes[link.target].node_type == "router":
                dest_router = link.target
            elif link.target == dest_net and self.nodes[link.source].node_type == "router":
                dest_router = link.source
        
        if not source_router or not dest_router:
            return []
        
        # ルーティングテーブルを使って経路を決定
        path = [source_net, source_router]
        current_router = source_router
        
        while current_router != dest_router:
            if current_router not in self.routing_tables:
                break
            
            # 宛先ネットワークへの経路を探す
            if dest_net in self.routing_tables[current_router]:
                entry = self.routing_tables[current_router][dest_net]
                if entry.gateway == "0.0.0.0":  # 直接接続
                    path.append(dest_net)
                    break
                else:
                    # 次のホップを見つける
                    next_router = None
                    for link in self.links:
                        if ((link.source == current_router and self.nodes[link.target].node_type == "router") or
                            (link.target == current_router and self.nodes[link.source].node_type == "router")):
                            other_router = link.target if link.source == current_router else link.source
                            if other_router != current_router:
                                next_router = other_router
                                break
                    
                    if next_router:
                        path.append(next_router)
                        current_router = next_router
                    else:
                        break
            else:
                break
        
        if path[-1] != dest_net:
            path.append(dest_net)
        
        return path
    
    def add_event(self, event: str):
        timestamp = time.strftime("%H:%M:%S")
        self.event_log.append(f"[{timestamp}] {event}")
        if len(self.event_log) > 50:
            self.event_log.pop(0)
    
    def simulate_rip_exchange(self):
        """RIP情報交換をシミュレートする"""
        # 初期状態で各ルーターは直接接続のネットワークのみ知っている
        initial_tables = {
            "R1": {
                "192.168.1.0/24": RoutingEntry("192.168.1.0/24", "0.0.0.0", "eth0", 0, "Connected"),
                "192.168.4.0/24": RoutingEntry("192.168.4.0/24", "0.0.0.0", "eth2", 0, "Connected"),
            },
            "R2": {
                "192.168.2.0/24": RoutingEntry("192.168.2.0/24", "0.0.0.0", "eth2", 0, "Connected"),
                "192.168.5.0/24": RoutingEntry("192.168.5.0/24", "0.0.0.0", "eth3", 0, "Connected"),
            },
            "R3": {
                "192.168.3.0/24": RoutingEntry("192.168.3.0/24", "0.0.0.0", "eth2", 0, "Connected"),
            }
        }
        
        # RIP学習プロセスの各段階
        learning_stages = [
            {
                "stage": 1,
                "description": "初期状態：各ルーターは直接接続のネットワークのみ",
                "tables": copy.deepcopy(initial_tables)
            },
            {
                "stage": 2,
                "description": "第1回情報交換：隣接ルーターから情報を学習",
                "tables": {
                    "R1": {
                        "192.168.1.0/24": RoutingEntry("192.168.1.0/24", "0.0.0.0", "eth0", 0, "Connected"),
                        "192.168.4.0/24": RoutingEntry("192.168.4.0/24", "0.0.0.0", "eth2", 0, "Connected"),
                        "192.168.2.0/24": RoutingEntry("192.168.2.0/24", "192.168.100.2", "eth1", 1, "RIP"),
                        "192.168.5.0/24": RoutingEntry("192.168.5.0/24", "192.168.100.2", "eth1", 1, "RIP"),
                    },
                    "R2": {
                        "192.168.2.0/24": RoutingEntry("192.168.2.0/24", "0.0.0.0", "eth2", 0, "Connected"),
                        "192.168.5.0/24": RoutingEntry("192.168.5.0/24", "0.0.0.0", "eth3", 0, "Connected"),
                        "192.168.1.0/24": RoutingEntry("192.168.1.0/24", "192.168.100.1", "eth0", 1, "RIP"),
                        "192.168.4.0/24": RoutingEntry("192.168.4.0/24", "192.168.100.1", "eth0", 1, "RIP"),
                        "192.168.3.0/24": RoutingEntry("192.168.3.0/24", "192.168.200.3", "eth1", 1, "RIP"),
                    },
                    "R3": {
                        "192.168.3.0/24": RoutingEntry("192.168.3.0/24", "0.0.0.0", "eth2", 0, "Connected"),
                        "192.168.2.0/24": RoutingEntry("192.168.2.0/24", "192.168.200.2", "eth0", 1, "RIP"),
                        "192.168.5.0/24": RoutingEntry("192.168.5.0/24", "192.168.200.2", "eth0", 1, "RIP"),
                    }
                }
            },
            {
                "stage": 3,
                "description": "第2回情報交換：さらに遠いネットワークを学習",
                "tables": {
                    "R1": {
                        "192.168.1.0/24": RoutingEntry("192.168.1.0/24", "0.0.0.0", "eth0", 0, "Connected"),
                        "192.168.4.0/24": RoutingEntry("192.168.4.0/24", "0.0.0.0", "eth2", 0, "Connected"),
                        "192.168.2.0/24": RoutingEntry("192.168.2.0/24", "192.168.100.2", "eth1", 1, "RIP"),
                        "192.168.5.0/24": RoutingEntry("192.168.5.0/24", "192.168.100.2", "eth1", 1, "RIP"),
                        "192.168.3.0/24": RoutingEntry("192.168.3.0/24", "192.168.100.2", "eth1", 2, "RIP"),
                    },
                    "R2": {
                        "192.168.2.0/24": RoutingEntry("192.168.2.0/24", "0.0.0.0", "eth2", 0, "Connected"),
                        "192.168.5.0/24": RoutingEntry("192.168.5.0/24", "0.0.0.0", "eth3", 0, "Connected"),
                        "192.168.1.0/24": RoutingEntry("192.168.1.0/24", "192.168.100.1", "eth0", 1, "RIP"),
                        "192.168.4.0/24": RoutingEntry("192.168.4.0/24", "192.168.100.1", "eth0", 1, "RIP"),
                        "192.168.3.0/24": RoutingEntry("192.168.3.0/24", "192.168.200.3", "eth1", 1, "RIP"),
                    },
                    "R3": {
                        "192.168.3.0/24": RoutingEntry("192.168.3.0/24", "0.0.0.0", "eth2", 0, "Connected"),
                        "192.168.2.0/24": RoutingEntry("192.168.2.0/24", "192.168.200.2", "eth0", 1, "RIP"),
                        "192.168.5.0/24": RoutingEntry("192.168.5.0/24", "192.168.200.2", "eth0", 1, "RIP"),
                        "192.168.1.0/24": RoutingEntry("192.168.1.0/24", "192.168.200.2", "eth0", 2, "RIP"),
                        "192.168.4.0/24": RoutingEntry("192.168.4.0/24", "192.168.200.2", "eth0", 2, "RIP"),
                    }
                }
            }
        ]
        
        return learning_stages
    
    def generate_quiz_question(self):
        """穴埋め問題を生成する"""
        quiz_questions = [
            {
                "id": 1,
                "question": "ルーター1から192.168.3.0/24へのパケット送信時、次のホップのゲートウェイは？",
                "router": "R1",
                "destination": "192.168.3.0/24",
                "blank_field": "gateway",
                "correct_answer": "192.168.100.2",
                "choices": ["192.168.100.2", "0.0.0.0", "192.168.200.3", "192.168.1.1"],
                "explanation": "ルーター1から192.168.3.0/24に到達するには、まずルーター2（192.168.100.2）を経由する必要があります。"
            },
            {
                "id": 2,
                "question": "ルーター2から192.168.4.0/24へのパケット送信時、使用するインターフェースは？",
                "router": "R2",
                "destination": "192.168.4.0/24",
                "blank_field": "interface",
                "correct_answer": "eth0",
                "choices": ["eth0", "eth1", "eth2", "eth3"],
                "explanation": "ルーター2から192.168.4.0/24に到達するには、ルーター1方向のeth0インターフェースを使用します。"
            },
            {
                "id": 3,
                "question": "ルーター3から192.168.1.0/24への経路のメトリック（ホップ数）は？",
                "router": "R3",
                "destination": "192.168.1.0/24",
                "blank_field": "metric",
                "correct_answer": "2",
                "choices": ["1", "2", "3", "0"],
                "explanation": "ルーター3から192.168.1.0/24に到達するには、R3 → R2 → R1の2ホップが必要です。"
            }
        ]
        
        return quiz_questions

def create_network_graph(simulator: NetworkSimulator, highlight_path: List[str] = None, current_node: str = None):
    fig = go.Figure()
    
    # ノードの位置とデータを準備
    node_trace_routers = go.Scatter(
        x=[], y=[], mode='markers+text',
        marker=dict(size=35, color='#3498DB', line=dict(width=3, color='#2C3E50')),
        text=[], textposition="middle center",
        hoverinfo='text', hovertext=[],
        name="ルーター",
        textfont=dict(color='white', size=12, family='Arial Black')
    )
    
    node_trace_networks = go.Scatter(
        x=[], y=[], mode='markers+text',
        marker=dict(size=30, color='#2ECC71', line=dict(width=3, color='#27AE60'), symbol='square'),
        text=[], textposition="middle center",
        hoverinfo='text', hovertext=[],
        name="ネットワーク",
        textfont=dict(color='white', size=10, family='Arial Black')
    )
    
    # エッジ（リンク）を描画
    edge_x = []
    edge_y = []
    
    for link in simulator.links:
        if not link.is_active:
            continue
        
        x0, y0 = simulator.nodes[link.source].position
        x1, y1 = simulator.nodes[link.target].position
        
        edge_x.extend([x0, x1, None])
        edge_y.extend([y0, y1, None])
    
    edge_trace = go.Scatter(
        x=edge_x, y=edge_y, mode='lines',
        line=dict(width=3, color='#2C3E50'),
        hoverinfo='none',
        showlegend=False
    )
    
    # ノードを追加
    for node_id, node in simulator.nodes.items():
        x, y = node.position
        
        if node.node_type == "router":
            node_trace_routers['x'] += (x,)
            node_trace_routers['y'] += (y,)
            node_trace_routers['text'] += (node.name,)
            node_trace_routers['hovertext'] += (f"{node.name}<br>クリックでルーティングテーブル表示",)
        else:
            node_trace_networks['x'] += (x,)
            node_trace_networks['y'] += (y,)
            node_trace_networks['text'] += (node.name.split('/')[0].split('.')[-2:][0] + '.' + node.name.split('/')[0].split('.')[-1],)
            node_trace_networks['hovertext'] += (f"{node.name}",)
    
    # ハイライトパスがある場合の処理
    if highlight_path:
        highlight_edge_x = []
        highlight_edge_y = []
        
        for i in range(len(highlight_path) - 1):
            current = highlight_path[i]
            next_node = highlight_path[i + 1]
            
            if current in simulator.nodes and next_node in simulator.nodes:
                x0, y0 = simulator.nodes[current].position
                x1, y1 = simulator.nodes[next_node].position
                
                highlight_edge_x.extend([x0, x1, None])
                highlight_edge_y.extend([y0, y1, None])
        
        highlight_edge_trace = go.Scatter(
            x=highlight_edge_x, y=highlight_edge_y, mode='lines',
            line=dict(width=6, color='#E74C3C'),
            hoverinfo='none',
            showlegend=False
        )
        
        fig.add_trace(highlight_edge_trace)
    
    # 現在のノードをハイライト
    if current_node and current_node in simulator.nodes:
        x, y = simulator.nodes[current_node].position
        current_node_trace = go.Scatter(
            x=[x], y=[y], mode='markers',
            marker=dict(size=45, color='#F39C12', line=dict(width=4, color='#E67E22')),
            showlegend=False, hoverinfo='none'
        )
        fig.add_trace(current_node_trace)
    
    fig.add_trace(edge_trace)
    fig.add_trace(node_trace_routers)
    fig.add_trace(node_trace_networks)
    
    fig.update_layout(
        title="ネットワーク構成図",
        showlegend=False,
        hovermode='closest',
        margin=dict(b=20,l=5,r=5,t=40),
        annotations=[ dict(
            text="ルーターをクリックするとルーティングテーブルが表示されます",
            showarrow=False,
            xref="paper", yref="paper",
            x=0.005, y=-0.002,
            xanchor='left', yanchor='bottom',
            font=dict(color="gray", size=12)
        )],
        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        plot_bgcolor='#F8F9FA',
        height=400
    )
    
    return fig

def display_routing_table(simulator: NetworkSimulator, router_id: str):
    if router_id not in simulator.routing_tables:
        st.warning(f"ルーター {router_id} のルーティングテーブルが見つかりません。")
        return
    
    st.subheader(f"📊 {simulator.nodes[router_id].name} のルーティングテーブル")
    
    table_data = []
    for dest, entry in simulator.routing_tables[router_id].items():
        table_data.append({
            "宛先ネットワーク": dest,
            "ゲートウェイ": entry.gateway if entry.gateway != "0.0.0.0" else "直接接続",
            "インターフェース": entry.interface,
            "メトリック": entry.metric,
            "プロトコル": entry.protocol
        })
    
    df = pd.DataFrame(table_data)
    st.dataframe(df, use_container_width=True)
    
    # 説明
    with st.expander("📝 ルーティングテーブルの説明"):
        st.markdown("""
        **各項目の説明：**
        - **宛先ネットワーク**: パケットの送信先となるネットワークアドレス
        - **ゲートウェイ**: 宛先に到達するための次のルーター（直接接続の場合は「直接接続」）
        - **インターフェース**: パケットを送信するインターフェース名
        - **メトリック**: 宛先までの「距離」（ホップ数）。小さいほど近い
        - **プロトコル**: この経路情報の取得方法（Connected=直接接続、Static=手動設定、RIP=動的学習）
        """)

# セッション状態の初期化
if 'simulator' not in st.session_state:
    st.session_state.simulator = NetworkSimulator()

if 'selected_router' not in st.session_state:
    st.session_state.selected_router = None

if 'packet_path' not in st.session_state:
    st.session_state.packet_path = []

if 'current_packet_position' not in st.session_state:
    st.session_state.current_packet_position = 0

if 'packet_animation_active' not in st.session_state:
    st.session_state.packet_animation_active = False

if 'rip_simulation_active' not in st.session_state:
    st.session_state.rip_simulation_active = False

if 'rip_current_stage' not in st.session_state:
    st.session_state.rip_current_stage = 0

if 'rip_stages' not in st.session_state:
    st.session_state.rip_stages = []

if 'quiz_mode' not in st.session_state:
    st.session_state.quiz_mode = False

if 'current_quiz' not in st.session_state:
    st.session_state.current_quiz = None

if 'quiz_answer' not in st.session_state:
    st.session_state.quiz_answer = None

if 'quiz_submitted' not in st.session_state:
    st.session_state.quiz_submitted = False

# メインUI
col1, col2 = st.columns([1, 1])

with col1:
    st.subheader("🚀 パケット送信シミュレーション")
    
    # ネットワーク選択
    network_nodes = [node_id for node_id, node in st.session_state.simulator.nodes.items() if node.node_type == "network"]
    
    source_net = st.selectbox("出発地ネットワーク", network_nodes, key="source")
    dest_net = st.selectbox("目的地ネットワーク", network_nodes, key="dest")
    
    if st.button("📤 パケット送信", type="primary"):
        if source_net != dest_net:
            path = st.session_state.simulator.find_path(source_net, dest_net)
            st.session_state.packet_path = path
            st.session_state.current_packet_position = 0
            st.session_state.packet_animation_active = True
            st.session_state.simulator.add_event(f"パケット送信開始: {source_net} → {dest_net}")
            st.success(f"パケット送信開始！経路: {' → '.join(path)}")
        else:
            st.warning("出発地と目的地が同じです。")

with col2:
    st.subheader("🔄 ルーティングプロトコル")
    
    if not st.session_state.rip_simulation_active:
        if st.button("🔄 RIP情報交換開始", type="secondary"):
            st.session_state.rip_stages = st.session_state.simulator.simulate_rip_exchange()
            st.session_state.rip_current_stage = 0
            st.session_state.rip_simulation_active = True
            st.session_state.simulator.add_event("RIP情報交換シミュレーションを開始しました")
            st.success("RIP情報交換シミュレーション開始！")
    else:
        col2_1, col2_2 = st.columns(2)
        with col2_1:
            if st.button("⏭️ 次の段階", type="secondary"):
                if st.session_state.rip_current_stage < len(st.session_state.rip_stages) - 1:
                    st.session_state.rip_current_stage += 1
                    current_stage = st.session_state.rip_stages[st.session_state.rip_current_stage]
                    st.session_state.simulator.routing_tables = current_stage["tables"]
                    st.session_state.simulator.add_event(f"RIP段階{current_stage['stage']}: {current_stage['description']}")
                else:
                    st.success("RIPシミュレーション完了！")
        
        with col2_2:
            if st.button("🔄 リセット", type="secondary"):
                st.session_state.rip_simulation_active = False
                st.session_state.rip_current_stage = 0
                st.session_state.simulator.initialize_routing_tables()
                st.session_state.simulator.add_event("RIPシミュレーションをリセットしました")
        
        # 現在の段階を表示
        if st.session_state.rip_stages:
            current_stage = st.session_state.rip_stages[st.session_state.rip_current_stage]
            st.info(f"**段階 {current_stage['stage']}**: {current_stage['description']}")

# ネットワーク図の表示
st.subheader("🌐 ネットワーク構成")

highlight_path = st.session_state.packet_path if st.session_state.packet_animation_active else None
current_node = None
if st.session_state.packet_animation_active and st.session_state.packet_path:
    if st.session_state.current_packet_position < len(st.session_state.packet_path):
        current_node = st.session_state.packet_path[st.session_state.current_packet_position]

fig = create_network_graph(st.session_state.simulator, highlight_path, current_node)
network_chart = st.plotly_chart(fig, use_container_width=True, key="network_graph")

# 穴埋め問題表示
if st.session_state.quiz_mode and st.session_state.current_quiz:
    st.subheader("📝 穴埋め問題")
    
    quiz = st.session_state.current_quiz
    st.markdown(f"**問題 {quiz['id']}**: {quiz['question']}")
    
    # ルーティングテーブルを表示（該当行をハイライト）
    if quiz['router'] in st.session_state.simulator.routing_tables:
        st.subheader(f"📊 {st.session_state.simulator.nodes[quiz['router']].name} のルーティングテーブル")
        
        table_data = []
        for dest, entry in st.session_state.simulator.routing_tables[quiz['router']].items():
            row = {
                "宛先ネットワーク": dest,
                "ゲートウェイ": entry.gateway if entry.gateway != "0.0.0.0" else "直接接続",
                "インターフェース": entry.interface,
                "メトリック": entry.metric,
                "プロトコル": entry.protocol
            }
            
            # 問題の対象行を強調表示
            if dest == quiz['destination']:
                if quiz['blank_field'] == 'gateway':
                    row['ゲートウェイ'] = "❓ ???"
                elif quiz['blank_field'] == 'interface':
                    row['インターフェース'] = "❓ ???"
                elif quiz['blank_field'] == 'metric':
                    row['メトリック'] = "❓ ???"
            
            table_data.append(row)
        
        df = pd.DataFrame(table_data)
        st.dataframe(df, use_container_width=True)
    
    # 選択肢
    if not st.session_state.quiz_submitted:
        st.subheader("解答を選択してください")
        selected_answer = st.radio("選択肢:", quiz['choices'], key="quiz_radio")
        
        if st.button("✅ 解答提出", type="primary"):
            st.session_state.quiz_answer = selected_answer
            st.session_state.quiz_submitted = True
            st.rerun()
    
    # 解答結果表示
    if st.session_state.quiz_submitted:
        if st.session_state.quiz_answer == quiz['correct_answer']:
            st.success("🎉 正解！")
            st.balloons()
        else:
            st.error(f"❌ 不正解。正答は: {quiz['correct_answer']}")
        
        st.info(f"**解説**: {quiz['explanation']}")
        
        # 経路をハイライト表示
        if quiz['destination'] in ["192.168.3.0/24", "192.168.1.0/24"]:
            if quiz['router'] == "R1" and quiz['destination'] == "192.168.3.0/24":
                highlight_path = ["R1", "R2", "R3", "net3"]
            elif quiz['router'] == "R3" and quiz['destination'] == "192.168.1.0/24":
                highlight_path = ["R3", "R2", "R1", "net1"]
            elif quiz['router'] == "R2" and quiz['destination'] == "192.168.4.0/24":
                highlight_path = ["R2", "R1", "net4"]
            else:
                highlight_path = []
            
            if highlight_path:
                st.subheader("📍 経路の可視化")
                quiz_fig = create_network_graph(st.session_state.simulator, highlight_path)
                st.plotly_chart(quiz_fig, use_container_width=True)
        
        if st.button("🔄 新しい問題", type="secondary"):
            quiz_questions = st.session_state.simulator.generate_quiz_question()
            st.session_state.current_quiz = random.choice(quiz_questions)
            st.session_state.quiz_submitted = False
            st.session_state.quiz_answer = None
            st.rerun()

# タブエリア
if not st.session_state.quiz_mode:
    tab1, tab2, tab3 = st.tabs(["📊 ルーティングテーブル", "📜 イベントログ", "📚 プロトコル説明"])

    with tab1:
        if st.session_state.selected_router:
            display_routing_table(st.session_state.simulator, st.session_state.selected_router)
        else:
            st.info("ネットワーク図上のルーターをクリックして、ルーティングテーブルを表示してください。")
            
            # 全ルーターのテーブルを表示するオプション
            if st.button("すべてのルーティングテーブルを表示"):
                for router_id in ["R1", "R2", "R3"]:
                    if router_id in st.session_state.simulator.routing_tables:
                        display_routing_table(st.session_state.simulator, router_id)
                        st.divider()

    with tab2:
        st.subheader("📜 イベントログ")
        for event in reversed(st.session_state.simulator.event_log[-10:]):
            st.text(event)

    with tab3:
        st.subheader("📚 ルーティングプロトコルの説明")
        
        protocol_tabs = st.tabs(["基本概念", "Static Routing", "RIP", "OSPF"])
        
        with protocol_tabs[0]:
            st.markdown("""
            ### ルーティングとは？
            
            **ルーティング**は、ネットワーク上でデータパケットを送信元から宛先まで最適な経路で配送するプロセスです。
            
            #### 主要な概念
            - **ルーティングテーブル**: ルーターが持つ「地図」のような情報
            - **メトリック**: 経路の「距離」や「コスト」
            - **ネクストホップ**: パケットが次に向かうべきルーター
            - **インターフェース**: ルーターの各ポート
            """)
        
        with protocol_tabs[1]:
            st.markdown("""
            ### スタティックルーティング
            
            **手動設定による固定的な経路制御**
            
            #### 特徴
            - 管理者が手動でルーティングテーブルを設定
            - 設定後は自動変更されない
            - 小規模ネットワークに適している
            
            #### メリット・デメリット
            ✅ **メリット**: 確実性、セキュリティ、帯域の無駄がない  
            ❌ **デメリット**: 管理負荷、障害時の自動復旧不可
            """)
        
        with protocol_tabs[2]:
            st.markdown("""
            ### RIP (Routing Information Protocol)
            
            **距離ベクトル型の動的ルーティングプロトコル**
            
            #### 動作原理
            1. 各ルーターが隣接ルーターに自分の経路情報を定期送信
            2. 受信した情報をもとに自分のルーティングテーブルを更新
            3. メトリックにはホップ数を使用（最大15ホップ）
            
            #### 特徴
            - シンプルで理解しやすい
            - 30秒間隔で情報交換
            - 収束に時間がかかる場合がある
            """)
        
        with protocol_tabs[3]:
            st.markdown("""
            ### OSPF (Open Shortest Path First)
            
            **リンクステート型の高度なルーティングプロトコル**
            
            #### 動作原理
            1. 各ルーターがネットワーク全体のトポロジを把握
            2. 最短パス優先アルゴリズム（SPF）で最適経路を計算
            3. エリア分割による階層化設計が可能
            
            #### 特徴
            - 高速な収束
            - ループフリー
            - 大規模ネットワークに適している
            """)

# パケットアニメーション用の自動更新（簡易版）
if st.session_state.packet_animation_active:
    if st.button("⏭️ パケット移動"):
        if st.session_state.current_packet_position < len(st.session_state.packet_path) - 1:
            st.session_state.current_packet_position += 1
            current_step = st.session_state.packet_path[st.session_state.current_packet_position]
            st.session_state.simulator.add_event(f"パケットが {current_step} に到着")
            
            # ルーターでの処理を表示
            if current_step in st.session_state.simulator.routing_tables:
                st.session_state.selected_router = current_step
                
        else:
            st.session_state.packet_animation_active = False
            st.session_state.simulator.add_event("パケット送信完了")
            st.success("パケットが目的地に到着しました！")

# 学習モードセクション
st.divider()
st.subheader("📚 学習モード")

# 穴埋め問題ボタンと説明
col_quiz1, col_quiz2 = st.columns([3, 1])

with col_quiz1:
    st.markdown("""
    **穴埋め問題で理解度をチェック！**  
    ルーティングテーブルの各項目について、実際の問題を解きながら理解を深めましょう。
    """)

with col_quiz2:
    if not st.session_state.quiz_mode:
        if st.button("📝 穴埋め問題開始", type="primary", use_container_width=True):
            quiz_questions = st.session_state.simulator.generate_quiz_question()
            st.session_state.current_quiz = random.choice(quiz_questions)
            st.session_state.quiz_mode = True
            st.session_state.quiz_submitted = False
            st.session_state.quiz_answer = None
            st.session_state.simulator.add_event("穴埋め問題モードを開始しました")
            st.rerun()
    else:
        if st.button("🏠 メインに戻る", type="secondary", use_container_width=True):
            st.session_state.quiz_mode = False
            st.session_state.current_quiz = None
            st.session_state.quiz_submitted = False
            st.session_state.quiz_answer = None
            st.rerun()

st.divider()
