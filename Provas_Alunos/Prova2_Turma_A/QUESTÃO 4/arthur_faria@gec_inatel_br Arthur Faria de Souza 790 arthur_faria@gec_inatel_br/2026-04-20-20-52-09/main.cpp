#include <iostream>
#include <iomanip>

using namespace std;

int main(){
    int v[10000],x , S1 =0,i = 0, j = 0, S2 = 0;
    double M = 0;
    char o;
    cin >> x;
    
   while(x != 0){
    if(x > 0){
     v[i] = x;
     S1++;
     cin >> x;
    }
    
    if(x < 0){
    v[j] = x;
    S2++;
    cin >> x;
    }
   }
    
    cin >> o;
    
    if(o == 'p'){
        M = v[i]/S1;
        cout << fixed << setprecision(3);
        cout << "media = " << M << endl;
    } else if (o == 'n'){
        M = v[j]/S2;
        cout << fixed << setprecision(3);
        cout << "media = " << M << endl;
    }
    
    return 0;
}