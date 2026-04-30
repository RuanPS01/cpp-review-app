#include <iostream>
#include <iomanip>
using namespace std;

int main (){
    int n, x, num;
    cin >>n;
    while ( n != 0){
        x += n;
        num++; 
        cin >> x;
    }
    cout << fixed << setprecision (2)<<"porcentagem"  << endl;
    return 0;
     
}