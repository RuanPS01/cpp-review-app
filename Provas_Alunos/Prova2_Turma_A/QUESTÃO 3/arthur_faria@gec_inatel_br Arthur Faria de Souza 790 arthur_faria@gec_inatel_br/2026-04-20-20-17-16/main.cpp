#include <iostream>
#include <iomanip>

using namespace std;

int main(){
    int M, v[10000],i = 0, S = 0,E = 0;
    cin >> M;
    
    while( M != 0){
        if(M != 10){
        v[i] += M;
        S ++;
        cin >> M;
        }else if (M == 10){
            E++;
            v[i] += M;
            cin >> M;
        }
        
    }
    cout << "Total de moedas: " << v[i] << endl;
    cout << "Cavernas com 10 moedas: "<< E << endl;
    
    return 0;
}