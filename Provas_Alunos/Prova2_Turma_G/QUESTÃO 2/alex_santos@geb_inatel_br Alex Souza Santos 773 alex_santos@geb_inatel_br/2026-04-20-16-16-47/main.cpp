#include<iostream>
#include<iomanip>
using namespace std;

int main(){
    int N;
    cin >> N;
    
    int num;
    
    for(int i = 0; i < N;i++){
        cin >> num;
    }
    
    double media = num;
    
    
    cout << fixed << setprecision(4) << media << endl;
    
    
    
    return 0;
}