#include <iostream>

using namespace std;

int main(){
    int n,numeros, div_por3 = 0;
    
    cin >> n;
    for( int i = 0; i < n; i++){
        cin >> numeros;
        
        if(numeros % 3 == 0){
            div_por3++;
            
        }
    }
    cout << div_por3 << endl;
    return 0;
}