import { Component, Input, OnInit } from '@angular/core';

import { Point, Events, Site, DCEL, BTree, HalfEdge, SitePair, clipEdges, closeCells } from '../ds/all-elements';
import { BSTree } from 'typescript-collections';


@Component({
  selector: 'voronoi',
  templateUrl: './voronoi.component.html',
  styleUrls: ['./voronoi.component.css']
})
export class VoronoiComponent implements OnInit {

  @Input() yMax: number;
  @Input() yMin: number;
  @Input() xMax: number;
  @Input() xMin: number;
  // should be more than 2 points
  @Input() numberOfPoints: number;
  points: Array<Point> = [];
  private events: Events;
  private dcel = new DCEL();
  private tree: BTree;
  private sideIdCounter = 0;
  private sitePointIds: number[] = [];
  private bbox = {
    xl: 0,
    xr: 100,
    yt: 100,
    yb: 0
  };

  ngOnInit() {
    this.generateMyVoronoi();
  }

  private generateMyVoronoi(): void {
    if (!this.numberOfPoints) {
      return;
    }
    // let x = 20;
    // let y = 20;
    // for (let i = 0; i < this.numberOfPoints; i++) {
    //   let point = new Point(x, y);
    //   this.points.push(point);
    //   this.sitePointIds.push(point.id);
    //   x += 5;
    //   y += 5;
    // }
    this.points = [new Point(10, 30), new Point(25, 55), new Point(45, 50), new Point(30, 60)];
    for (let i = 0; i < this.points.length; i++) {
      this.sitePointIds.push(this.points[i].id);
    }
    this.events = new Events(this.points);



    // let site1 = new Site(this.events.pop());
    // let site2 = new Site(this.events.pop());


    // if (site1.point.x < site2.point.x) {
    //   let newSitePair = new SitePair(site1, site2);

    //   let newHalfEdge = new HalfEdge(site1, site2);
    //   newHalfEdge.populateEdgeAndTwinInfo(newSitePair);
    //   this.dcel.add(newHalfEdge);

    //   this.tree = new BTree(newSitePair, this.dcel);
    // } else {
    //   let newSitePair = new SitePair(site2, site1);

    //   let newHalfEdge = new HalfEdge(site2, site1);
    //   newHalfEdge.populateEdgeAndTwinInfo(newSitePair);
    //   this.dcel.add(newHalfEdge);

    //   this.tree = new BTree(newSitePair, this.dcel);
    // }

    while (!this.events.isEmpty()) {
      let event = this.events.pop();
      this.handleEvent(event, this.tree, this.dcel);
    }
    clipEdges(this.bbox, this.dcel);
    closeCells(this.bbox, this.dcel);
  }

  private clipEdges(): void {

  }

  private handleEvent(event: Point, tree: BTree, dcel: DCEL): void {
    if (this.sitePointIds.indexOf(event.id) >= 0) {
      this.handleSiteEvent(event, tree, dcel);
    } else {
      this.handleCircleEvent(event, tree, dcel);
    }
  }

  private handleSiteEvent(event: Point, tree: BTree, dcel: DCEL): void {
    let site = new Site(event);
    if (!tree) {
      tree = new BTree(site, this.dcel);
      this.tree = tree;
    }
    let nodeAtWhichSiteWasAdded = tree.add(site, dcel);
    this.dcel.checkAndGetCircleEvent(tree, this.events);
  }

  private handleCircleEvent(event: Point, tree: BTree, dcel: DCEL): void {
    let nodeFormedDueToSiteRemoval = tree.delete(tree, event, dcel);
    this.dcel.checkAndGetCircleEvent(tree, this.events);
  }

}
