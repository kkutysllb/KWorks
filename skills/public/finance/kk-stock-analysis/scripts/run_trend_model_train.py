#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
趋势预测模型训练脚本

使用本地 MongoDB 数据库中的股票数据进行模型训练。

用法:
    python scripts/run_trend_model_train.py
    python scripts/run_trend_model_train.py --stocks 000001.SZ,000002.SZ
    python scripts/run_trend_model_train.py --start-date 20200101 --end-date 20251231
    python scripts/run_trend_model_train.py --limit 50  # 只用50只股票测试
"""

import sys
import os
import json
import argparse
from datetime import datetime

_script_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_script_dir)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

# matplotlib 配置
import matplotlib
matplotlib.use('Agg')

from analysis.trend_analysis.core.trend_predictor import TrendPredictor
from analysis.trend_analysis.core.data_loader import TrendDataLoader
from analysis.trend_analysis.config.config import TrendAnalysisConfig


def get_all_stock_codes(data_loader, limit=None):
    """获取数据库中所有股票代码"""
    collection = data_loader.db_handler.get_collection('stock_kline_daily')
    ts_codes = collection.distinct('ts_code')
    if limit:
        ts_codes = ts_codes[:limit]
    return ts_codes


def main():
    parser = argparse.ArgumentParser(description="趋势预测模型训练")
    parser.add_argument("--stocks", dest="stock_codes", default=None, help="股票代码列表，逗号分隔")
    parser.add_argument("--start-date", dest="start_date", default="20190101", help="开始日期 YYYYMMDD")
    parser.add_argument("--end-date", dest="end_date", default=None, help="结束日期 YYYYMMDD")
    parser.add_argument("--limit", type=int, default=None, help="限制股票数量（用于测试）")
    parser.add_argument("--no-cv", dest="use_cv", action="store_false", default=True, help="禁用交叉验证")
    parser.add_argument("--multi-source", action="store_true", help="启用多源数据（价格+资金流向+融资融券+筹码分布）")
    parser.add_argument("--json", action="store_true", help="输出 JSON 格式")
    args = parser.parse_args()

    # 默认结束日期为今天
    end_date = args.end_date or datetime.now().strftime('%Y%m%d')

    print("=" * 60)
    print("📈 趋势预测模型训练")
    print("=" * 60)

    # 初始化
    config = TrendAnalysisConfig()
    data_loader = TrendDataLoader(config)
    predictor = TrendPredictor(config)

    # 获取股票列表
    if args.stock_codes:
        stock_codes = [s.strip() for s in args.stock_codes.split(',')]
        print(f"\n📋 使用指定的 {len(stock_codes)} 只股票")
    else:
        stock_codes = get_all_stock_codes(data_loader, limit=args.limit)
        print(f"\n📋 使用数据库中 {len(stock_codes)} 只股票")

    if not stock_codes:
        error_msg = "未找到可训练的股票数据"
        print(f"❌ {error_msg}")
        if args.json:
            print(json.dumps({"success": False, "error": error_msg}))
        sys.exit(1)

    print(f"📅 日期范围: {args.start_date} ~ {end_date}")
    print(f"🔧 交叉验证: {'启用' if args.use_cv else '禁用'}")

    # 执行训练
    print("\n🚀 开始训练...")
    try:
        # 多源数据模式
        if args.multi_source:
            print("🔀 使用多源数据模式（价格+资金流向+融资融券+筹码分布）")
            from analysis.trend_analysis.core.multi_source_features import (
                prepare_multi_source_features
            )
            try:
                from database.db_handler import get_db_handler
                _DB_AVAILABLE = True
            except ImportError:
                _DB_AVAILABLE = False
            
            db_handler = get_db_handler()
            
            price_features, mf_features, margin_features, chip_features, labels = \
                prepare_multi_source_features(
                    stock_codes=stock_codes,
                    start_date=args.start_date,
                    end_date=end_date,
                    db_handler=db_handler,
                    sequence_length=1
                )
            
            if price_features.empty:
                error_msg = "多源数据准备失败"
                print(f"❌ {error_msg}")
                if args.json:
                    print(json.dumps({"success": False, "error": error_msg}))
                sys.exit(1)
            
            # 合并所有特征
            from analysis.trend_analysis.core.multi_source_features import MultiSourceFeatureEngineer
            engineer = MultiSourceFeatureEngineer()
            features = engineer.merge_all_features(
                price_features, mf_features, margin_features, chip_features
            )
            
            # 移除股票代码列用于训练
            if 'stock_code' in features.columns:
                features = features.drop(columns=['stock_code'])
            if 'ts_code' in features.columns:
                features = features.drop(columns=['ts_code'])
            
            # 方向标签
            direction_labels = labels['direction'] if 'direction' in labels.columns else labels['label']
            strength_labels = labels['strength'] if 'strength' in labels.columns else pd.Series(0, index=labels.index)
        else:
            # 基础数据模式
            print("📊 准备训练数据...")
            raw_data, direction_labels, strength_labels = data_loader.prepare_training_data(
                stock_codes=stock_codes,
                start_date=args.start_date,
                end_date=end_date
            )

            if raw_data.empty:
                error_msg = "训练数据为空"
                print(f"❌ {error_msg}")
                if args.json:
                    print(json.dumps({"success": False, "error": error_msg}))
                sys.exit(1)

            # 生成特征
            print("🔧 生成特征工程...")
            features = predictor.feature_engineer.generate_features(raw_data)
            
            # 移除非数值列
            non_numeric_cols = features.select_dtypes(exclude=['number']).columns.tolist()
            if non_numeric_cols:
                print(f"   移除非数值列: {non_numeric_cols}")
                features = features.drop(columns=non_numeric_cols)

        # 清除 NaN 行（标签和特征中的 NaN）
        print("🧹 清除 NaN 数据...")
        nan_mask = ~(features.isna().any(axis=1) | direction_labels.isna() | strength_labels.isna())
        features = features[nan_mask]
        direction_labels = direction_labels[nan_mask]
        strength_labels = strength_labels[nan_mask]

        print(f"   有效训练样本: {len(features)} 条")

        if len(features) < 100:
            error_msg = f"有效训练样本不足（{len(features)} 条），需要更多数据"
            print(f"❌ {error_msg}")
            if args.json:
                print(json.dumps({"success": False, "error": error_msg}))
            sys.exit(1)

        # 数据分割
        from analysis.trend_analysis.utils.utils import time_series_split
        X_train, X_val, X_test, y_train_dir, y_val_dir, y_test_dir = \
            time_series_split(features, direction_labels)
        _, _, _, y_train_str, y_val_str, y_test_str = \
            time_series_split(features, strength_labels)

        # 训练方向模型
        print("🎯 训练趋势方向模型...")
        direction_result = predictor.model_trainer.train_direction_model(
            X_train, y_train_dir, X_val, y_val_dir
        )

        # 训练强度模型
        print("💪 训练趋势强度模型...")
        strength_result = predictor.model_trainer.train_strength_model(
            X_train, y_train_str, X_val, y_val_str
        )

        # 训练集成模型
        print("🔀 训练集成模型...")
        ensemble_result = predictor.model_trainer.train_ensemble_model(
            X_train, y_train_dir, X_val, y_val_dir
        )

        # 保存模型
        print("💾 保存模型...")
        predictor.model_trainer.save_models()

        # 保存特征名（用于预测时验证）
        feature_names = list(features.columns)
        feature_names_path = predictor.model_trainer.model_dir / 'feature_names.json'
        import json
        with open(feature_names_path, 'w') as f:
            json.dump(feature_names, f)
        print(f"   特征名已保存: {len(feature_names)} 个")

        print("\n✅ 训练成功!")

        if args.json:
            output = {
                "success": True,
                "stock_count": len(stock_codes),
                "date_range": f"{args.start_date}-{end_date}",
                "train_samples": len(features),
                "direction_model": direction_result.get('model_type'),
                "ensemble_model": ensemble_result.get('model_type'),
                "model_saved": True
            }
            print(json.dumps(output, ensure_ascii=False))
        else:
            print("\n📊 训练结果:")
            print(f"  方向模型: {direction_result.get('model_type')}")
            if 'train_metrics' in direction_result:
                print(f"  训练准确率: {direction_result['train_metrics'].get('accuracy', 'N/A')}")
            print(f"  集成模型: {ensemble_result.get('model_type')}")
            print(f"\n💾 模型已保存至: analysis/trend_analysis/models/")

    except Exception as e:
        error_msg = str(e)
        print(f"\n❌ 训练异常: {error_msg}")
        import traceback
        traceback.print_exc()
        if args.json:
            print(json.dumps({"success": False, "error": error_msg}))
        sys.exit(1)


if __name__ == "__main__":
    main()
